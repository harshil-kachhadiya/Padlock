const app = document.getElementById("app");

// Tracks which sites have already been auto-filled this popup session, so
// re-rendering the vault list (after editing or deleting an entry, say)
// doesn't re-trigger a fill the user didn't just ask for. Popups are
// non-persistent in MV3 — this resets naturally every time the popup opens.
const autoFilledSiteIds = new Set();

function render(templateId) {
  const template = document.getElementById(templateId);
  app.replaceChildren(template.content.cloneNode(true));
}

function on(action, handler) {
  const el = app.querySelector(`[data-action="${action}"]`);
  if (el) el.addEventListener("click", handler);
}

function renderLoading(message = "Loading…") {
  render("tpl-loading");
  const msgEl = app.querySelector("#loading-message");
  if (msgEl) msgEl.textContent = message;
}

// Extension popups close the instant they lose focus, killing any pending
// setTimeout — so auto-clear needs a "check on next open" fallback too (same
// pattern as the vault's auto-lock), not just a live timer for while it's open.
const CLIPBOARD_CLEAR_MS = 20_000;
const CLIPBOARD_STORAGE_KEY = "padlock_clipboard_copy";
let clipboardGeneration = 0;

async function checkStaleClipboard() {
  const stored = await chrome.storage.session.get(CLIPBOARD_STORAGE_KEY);
  const entry = stored[CLIPBOARD_STORAGE_KEY];
  if (!entry) return;

  if (Date.now() - entry.copiedAt >= CLIPBOARD_CLEAR_MS) {
    try {
      await navigator.clipboard.writeText("");
    } catch {
      /* clipboard unavailable without focus — nothing more we can do here */
    }
    await chrome.storage.session.remove(CLIPBOARD_STORAGE_KEY);
  }
}

async function copyToClipboard(text, { autoClear = false, label = "Copied" } = {}) {
  await navigator.clipboard.writeText(text);

  if (!autoClear) {
    showToast(label, "success");
    return;
  }

  const myGeneration = ++clipboardGeneration;
  await chrome.storage.session.set({
    [CLIPBOARD_STORAGE_KEY]: { text, copiedAt: Date.now() },
  });

  showToast(`${label} — clipboard clears in 20s`, "success");

  setTimeout(async () => {
    if (clipboardGeneration !== myGeneration) return; // a newer copy took over
    try {
      await navigator.clipboard.writeText("");
    } catch {
      /* popup likely closed — the next-open check above will catch it */
    }
    await chrome.storage.session.remove(CLIPBOARD_STORAGE_KEY);
  }, CLIPBOARD_CLEAR_MS);
}

let toastTimeout;
let toastHideTimeout;

function showToast(message, variant = "info", action = null, durationMs = null) {
  const toast = document.getElementById("toast");
  clearTimeout(toastTimeout);
  clearTimeout(toastHideTimeout);

  toast.hidden = false;
  toast.className = `toast${variant !== "info" ? ` toast-${variant}` : ""}`;
  toast.replaceChildren();

  const messageEl = document.createElement("span");
  messageEl.textContent = message;
  toast.appendChild(messageEl);

  if (action) {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "toast-action";
    actionBtn.textContent = action.label;
    actionBtn.addEventListener("click", () => {
      clearTimeout(toastTimeout);
      clearTimeout(toastHideTimeout);
      toast.classList.remove("show");
      toastHideTimeout = setTimeout(() => {
        toast.hidden = true;
      }, 200);
      action.onClick();
    });
    toast.appendChild(actionBtn);
  }

  requestAnimationFrame(() => toast.classList.add("show"));

  const duration = durationMs ?? (action ? 5000 : 2200);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toastHideTimeout = setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, duration);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function getActiveTabUrl() {
  const tab = await getActiveTab();
  return tab?.url ?? "";
}

async function sendTabMessage(tab, message) {
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const messageText = error?.message || "";
    if (!/Receiving end does not exist|Could not establish connection/.test(messageText)) {
      throw error;
    }

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function boot() {
  try {
    await bootInner();
  } catch (err) {
    render("tpl-loading");
    const msgEl = app.querySelector("#loading-message");
    const spinner = app.querySelector(".spinner");
    if (spinner) spinner.style.display = "none";
    if (msgEl) msgEl.textContent = `Something went wrong: ${err.message}`;

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-secondary btn-sm";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", boot);
    msgEl?.after(retryBtn);
  }
}

async function bootInner() {
  checkStaleClipboard();
  const headerActions = document.querySelector(".header-actions");
  if (headerActions) headerActions.hidden = true;
  renderLoading("Checking session…");
  const session = await getSession();

  if (!session) {
    render("tpl-signin");
    on("sign-in", handleSignIn);
    return;
  }

  applyTheme(await fetchUserSetting(session.access_token, session.user.id, "theme", "light"));
  if (headerActions) headerActions.hidden = false;
  bindHeaderActions(session);

  renderLoading("Loading your account…");
  const userRow = await fetchUserRow(session.access_token, session.user.id);

  if (!userRow) {
    render("tpl-no-vault");
    on("open-website", () => chrome.tabs.create({ url: PADLOCK_CONFIG.WEBSITE_URL }));
    on("sign-out", handleSignOut);
    return;
  }

  let cachedKey = await loadVaultKey();

  if (cachedKey) {
    // The cached raw key has no associated salt or verifier version. If the
    // master password was changed on the website or another device after
    // this key was cached, every decrypt using it fails with a
    // DOMException: OperationError that gives no hint why — it looks
    // exactly like corrupted data instead of "this key is simply wrong."
    // Verifying against the current verifier here, every boot, is the fix:
    // catch a stale key before it silently breaks every entry.
    const stillValid = await checkVerifier(cachedKey, userRow.verifier);
    if (!stillValid) {
      await clearVaultKey();
      cachedKey = null;
    }
  }

  if (!cachedKey) {
    render("tpl-unlock");
    on("sign-out", handleSignOut);
    on("unlock", () => handleUnlock(session, userRow));

    const passwordInput = app.querySelector("#unlock-password");
    const capsLockWarning = app.querySelector("#unlock-capslock");
    const unlockBtn = app.querySelector('[data-action="unlock"]');

    function updateCapsLockWarning(e) {
      capsLockWarning.hidden = !e.getModifierState?.("CapsLock");
    }

    passwordInput.addEventListener("keydown", (e) => {
      updateCapsLockWarning(e);
      if (e.key === "Enter") handleUnlock(session, userRow);
    });
    passwordInput.addEventListener("keyup", updateCapsLockWarning);

    const lockout = await loadLockoutState(session.user.id);
    if (isLockedOut(lockout)) {
      applyLockoutCountdown(secondsUntilUnlocked(lockout), passwordInput, unlockBtn);
    }

    return;
  }

  await showVault(session, cachedKey);
}

async function handleSignIn() {
  try {
    await signInWithGoogle();
    await boot();
  } catch (err) {
    alert(`Sign-in failed: ${err.message}`);
  }
}

async function handleSignOut() {
  await signOut();
  await boot();
}

function applyLockoutCountdown(seconds, passwordInput, unlockBtn) {
  let remaining = seconds;
  passwordInput.disabled = true;
  unlockBtn.disabled = true;
  unlockBtn.textContent = `Locked — ${remaining}s`;

  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      passwordInput.disabled = false;
      unlockBtn.disabled = false;
      unlockBtn.textContent = "Unlock";
      return;
    }
    unlockBtn.textContent = `Locked — ${remaining}s`;
  }, 1000);
}

async function handleUnlock(session, userRow) {
  const passwordInput = app.querySelector("#unlock-password");
  const errorEl = app.querySelector("#unlock-error");
  const unlockBtn = app.querySelector('[data-action="unlock"]');
  const password = passwordInput.value;

  const existingLockout = await loadLockoutState(session.user.id);
  if (isLockedOut(existingLockout)) {
    applyLockoutCountdown(secondsUntilUnlocked(existingLockout), passwordInput, unlockBtn);
    return;
  }

  errorEl.hidden = true;
  unlockBtn.disabled = true;
  unlockBtn.textContent = "Unlocking…";

  try {
    // Falls back to the legacy default for any row from before this column
    // existed — see supabase/migrations/0010_pbkdf2_iterations.sql.
    const key = await deriveKey(password, userRow.salt, userRow.pbkdf2_iterations ?? 250_000);
    const valid = await checkVerifier(key, userRow.verifier);

    if (!valid) {
      const state = await recordFailedAttempt(session.user.id);

      if (isLockedOut(state)) {
        errorEl.textContent = `Too many incorrect attempts. Try again in ${secondsUntilUnlocked(state)}s.`;
        errorEl.hidden = false;
        applyLockoutCountdown(secondsUntilUnlocked(state), passwordInput, unlockBtn);
      } else {
        const remaining = lockoutAttemptsRemaining(state);
        errorEl.textContent = `Incorrect master password. ${remaining} attempt${remaining === 1 ? "" : "s"} left before a temporary lockout.`;
        errorEl.hidden = false;
        unlockBtn.disabled = false;
        unlockBtn.textContent = "Unlock";
      }
      return;
    }

    await recordUnlockSuccess(session.user.id);
    await storeVaultKey(key);
    await showVault(session, key);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Unlock";
  }
}

let systemThemeQuery;

function bindHeaderActions(session) {
  document.querySelectorAll(".header [data-theme]").forEach((button) => {
    button.addEventListener("click", async () => {
      const theme = button.dataset.theme;
      applyTheme(theme);
      try {
        await updateUserSetting(session.access_token, session.user.id, "theme", theme);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });

  document.querySelector('.header [data-action="lock"]').addEventListener("click", async () => {
    await clearVaultKey();
    await boot();
  });
}

function applyTheme(theme) {
  if (systemThemeQuery) {
    systemThemeQuery.removeEventListener("change", systemThemeQuery.listener);
    systemThemeQuery = null;
  }

  const setResolvedTheme = (resolvedTheme) => {
    document.body.dataset.theme = resolvedTheme === "dark" ? "dark" : "light";
  };

  if (theme === "system") {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.listener = (event) => setResolvedTheme(event.matches ? "dark" : "light");
    query.addEventListener("change", query.listener);
    systemThemeQuery = query;
    setResolvedTheme(query.matches ? "dark" : "light");
    return;
  }

  setResolvedTheme(theme);
}

async function showSettings(session, key) {
  render("tpl-settings");

  const errorEl = app.querySelector("#settings-error");
  const lockInput = app.querySelector("#setting-lock-chrome");
  const showAllInput = app.querySelector("#setting-show-all-items");
  const values = {
    lock_chrome_by_default: await fetchUserSetting(
      session.access_token,
      session.user.id,
      "lock_chrome_by_default",
      false
    ),
    show_all_items: await fetchUserSetting(
      session.access_token,
      session.user.id,
      "show_all_items",
      false
    ),
    theme: await fetchUserSetting(session.access_token, session.user.id, "theme", "light"),
  };

  lockInput.checked = Boolean(values.lock_chrome_by_default);
  showAllInput.checked = Boolean(values.show_all_items);
  applyTheme(values.theme);

  async function save(keyName, value) {
    try {
      await updateUserSetting(session.access_token, session.user.id, keyName, value);
      errorEl.hidden = true;
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  }

  lockInput.addEventListener("change", () =>
    save("lock_chrome_by_default", lockInput.checked)
  );
  showAllInput.addEventListener("change", () => save("show_all_items", showAllInput.checked));

  app.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;
      applyTheme(theme);
      save("theme", theme);
    });
  });

  on("back-to-vault", () => showVault(session, key));
}

// Shared by the manual "Autofill" button and the auto-fill-on-open path, so
// hint gating and messaging stay in exactly one place.
//
// Hint mode never decrypts or sends the real password at all — only the
// hint text goes to the content script, via a different message type
// (PADLOCK_SHOW_HINT) than normal autofill (PADLOCK_AUTOFILL). That's a
// deliberate second layer, not just a UI toggle: even a bug in the
// hintOnlyMode check can't leak the real password through this path,
// because this function never even decrypts it when useHint is true.
async function performAutofill(site, activePassword, key, hintOnlyMode) {
  const useHint = hintOnlyMode && Boolean(activePassword.encrypted_hint);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (useHint) {
    const hintText = await decryptEntry(key, activePassword.encrypted_hint);
    const response = await sendTabMessage(tab, {
      type: "PADLOCK_SHOW_HINT",
      username: site.username,
      hint: hintText,
    });
    return { status: "hint", filledUsername: Boolean(response?.filledUsername) };
  }

  const plaintext = await decryptEntry(key, activePassword.encrypted_password);
  const response = await sendTabMessage(tab, {
    type: "PADLOCK_AUTOFILL",
    username: site.username,
    password: plaintext,
  });

  if (response?.ok) {
    return {
      status: "filled",
      filledUsername: response.filledUsername,
      filledPassword: response.filledPassword,
    };
  }
  return { status: "no-form" };
}

function buildEntryNode(site, activePassword, session, key, onChanged, hintOnlyMode, matchReason) {
  const entryTemplate = document.getElementById("tpl-entry");
  const node = entryTemplate.content.cloneNode(true);
  node.querySelector(".entry-name").textContent = site.site_name;
  node.querySelector(".entry-username").textContent = site.username || "";

  const matchReasonEl = node.querySelector(".entry-match-reason");
  if (matchReason) {
    matchReasonEl.textContent = matchReason;
    matchReasonEl.hidden = false;
  }

  node.querySelector('[data-action="copy-username"]').addEventListener("click", () => {
    if (!site.username) return;
    copyToClipboard(site.username, { label: "Username copied" });
  });

  node.querySelector('[data-action="copy-password"]').addEventListener("click", async (e) => {
    const button = e.currentTarget;
    try {
      const plaintext = await decryptEntry(key, activePassword.encrypted_password);
      await copyToClipboard(plaintext, { autoClear: true, label: "Password copied" });
    } catch {
      showToast("Copy failed", "error");
    }
    button.blur();
  });

  node.querySelector('[data-action="autofill"]').addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    button.textContent = "Filling…";

    try {
      const result = await performAutofill(site, activePassword, key, hintOnlyMode);

      if (result.status === "hint") {
        showToast(
          result.filledUsername ? "Username filled — hint shown on the page" : "Hint shown on the page",
          "info"
        );
        button.textContent = "Hint shown";
      } else if (result.status === "filled") {
        const parts = [];
        if (result.filledUsername) parts.push("username");
        if (result.filledPassword) parts.push("password");
        showToast(`Filled ${parts.join(" & ")} for ${site.site_name}`, "success");
        button.textContent = "Filled";
      } else {
        showToast(`No login form found on this page for ${site.site_name}`, "error");
        button.textContent = "No form found";
      }
    } catch (err) {
      // "Could not establish connection" specifically means this tab has no
      // content script running — almost always because the extension was
      // reloaded/updated after the tab was opened. Content scripts only
      // inject on page load, so the fix really is "reload the tab", not
      // just a retry. Naming that case distinctly beats a generic failure
      // message, since the fix is different for each.
      const message = err?.message || "";
      const isNoContentScript = /Receiving end does not exist|Could not establish connection/.test(
        message
      );

      // Some failures here (WebCrypto decrypt errors in particular) throw a
      // DOMException whose .message can be an empty string, which made the
      // toast just say "unknown error" with no way to tell what actually
      // happened. Log everything identifiable about the real error so it's
      // readable from the popup's own devtools console (right-click the
      // extension icon -> Inspect popup) instead of being a dead end.
      console.error("Padlock: autofill failed", {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        raw: err,
      });

      showToast(
        isNoContentScript
          ? "This tab was open before Padlock last updated — reload the tab and try again"
          : `Autofill failed${err?.name ? ` (${err.name})` : ""}${message ? `: ${message}` : ""} — see the popup's console for details`,
        "error"
      );
      button.textContent = "Failed";
    } finally {
      setTimeout(() => {
        button.textContent = "Autofill";
        button.disabled = false;
      }, 1500);
    }
  });

  node.querySelector('[data-action="edit"]').addEventListener("click", () => {
    showEntryForm(session, key, { site, activePassword });
  });

  const actionsEl = node.querySelector(".entry-actions");
  const confirmEl = node.querySelector(".entry-confirm");

  node.querySelector('[data-action="delete"]').addEventListener("click", () => {
    actionsEl.hidden = true;
    confirmEl.hidden = false;
  });

  node.querySelector('[data-action="cancel-delete"]').addEventListener("click", () => {
    confirmEl.hidden = true;
    actionsEl.hidden = false;
  });

  node.querySelector('[data-action="confirm-delete"]').addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    button.textContent = "Deleting…";

    try {
      await softDeleteSite(session.access_token, site.id);

      showToast(`Deleted "${site.site_name}"`, "info", {
        label: "Undo",
        onClick: async () => {
          try {
            await undoDeleteSite(session.access_token, site.id);
            showToast(`Restored "${site.site_name}"`, "success");
          } catch (err) {
            showToast(err.message, "error");
          } finally {
            await onChanged();
          }
        },
      });

      await onChanged();
    } catch (err) {
      showToast(err.message, "error");
      button.disabled = false;
      button.textContent = "Delete";
      confirmEl.hidden = true;
      actionsEl.hidden = false;
    }
  });

  return node;
}

async function showVault(session, key) {
  render("tpl-vault");
  on("lock", async () => {
    await clearVaultKey();
    await boot();
  });
  on("add-entry", () => showEntryForm(session, key, null));

  const matchList = app.querySelector("#entry-list-match");
  const allList = app.querySelector("#entry-list-all");
  const matchEmpty = app.querySelector("#match-empty");
  const matchLabel = app.querySelector("#match-label");
  const allSection = app.querySelector("#all-section");

  matchLabel.hidden = true;
  matchEmpty.hidden = true;
  allSection.hidden = true;

  const activeUrl = await getActiveTabUrl();
  const activeHost = hostnameOf(activeUrl);
  const hintOnlyMode = await fetchUserSetting(
    session.access_token,
    session.user.id,
    "hint_only_mode",
    false
  );
  const autoFillSingleMatch = await fetchUserSetting(
    session.access_token,
    session.user.id,
    "auto_fill_single_match",
    false
  );
  const showAllItems = await fetchUserSetting(
    session.access_token,
    session.user.id,
    "show_all_items",
    false
  );

  let allSites;
  try {
    allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
  } catch (err) {
    matchLabel.hidden = true;
    allSection.hidden = true;
    matchEmpty.hidden = false;
    matchEmpty.textContent = `Couldn't load your vault: ${err.message}`;

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-secondary btn-sm";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", () => showVault(session, key));
    matchEmpty.after(retryBtn);
    return;
  }

  const entries = allSites
    .map((site) => {
      const activePassword = (site.passwords || [])
        .filter((p) => !p.deleted)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      return activePassword ? { site, activePassword } : null;
    })
    .filter(Boolean);

  const refresh = () => showVault(session, key);

  if (entries.length === 0) {
    matchLabel.hidden = true;
    matchEmpty.hidden = false;
    matchEmpty.textContent = "No entries yet. Add one above.";
    allSection.hidden = true;
    return;
  }

  if (!activeHost && !showAllItems) {
    matchEmpty.hidden = false;
    matchEmpty.textContent = "Open a website to see matching entries.";
    return;
  }

  if (!activeHost) {
    matchLabel.hidden = true;
    matchEmpty.hidden = true;
    allSection.hidden = false;
    allSection.open = true;
    allSection.querySelector(".section-summary").textContent = "All items";
    for (const { site, activePassword } of entries) {
      allList.appendChild(buildEntryNode(site, activePassword, session, key, refresh, hintOnlyMode));
    }
    return;
  }

  const matching = entries.filter(({ site }) =>
    hostsMatch(activeHost, hostnameOf(`https://${site.site_url}`))
  );
  const rest = entries.filter((entry) => !matching.includes(entry));

  matchLabel.hidden = false;
  allSection.hidden = !showAllItems;
  matchLabel.textContent = `This site (${activeHost})`;

  if (matching.length === 0) {
    matchEmpty.hidden = false;
  } else {
    for (const { site, activePassword } of matching) {
      const siteHost = hostnameOf(`https://${site.site_url}`);
      const reason =
        siteHost && siteHost !== activeHost ? `Saved for ${siteHost} — same domain` : null;
      matchList.appendChild(buildEntryNode(site, activePassword, session, key, refresh, hintOnlyMode, reason));
    }

    // Only ever auto-triggers for an unambiguous single match — with 2+
    // saved logins for a site there is no safe way to guess which one the
    // user wants, so those always fall back to a manual click regardless
    // of this setting.
    if (autoFillSingleMatch && matching.length === 1 && !autoFilledSiteIds.has(matching[0].site.id)) {
      const { site, activePassword } = matching[0];
      autoFilledSiteIds.add(site.id);

      performAutofill(site, activePassword, key, hintOnlyMode)
        .then((result) => {
          if (result.status === "hint") {
            showToast(
              result.filledUsername
                ? `Auto — username filled, hint shown for ${site.site_name}`
                : `Auto — hint shown for ${site.site_name}`,
              "info"
            );
          } else if (result.status === "filled") {
            const parts = [];
            if (result.filledUsername) parts.push("username");
            if (result.filledPassword) parts.push("password");
            showToast(`Auto-filled ${parts.join(" & ")} for ${site.site_name}`, "success");
          }
          // "no-form" is silent here — the popup just opened, nothing the
          // user clicked, so surfacing an error would be more surprising
          // than helpful.
        })
        .catch((err) => {
          // No toast — same reasoning as the no-form case above — but still
          // logged, so "auto-fill silently isn't happening" is debuggable
          // from devtools instead of a total black box.
          console.warn("Padlock: auto-fill-on-open failed:", err);
        });
    }
  }

  const expandByDefault = await fetchUserSetting(
    session.access_token,
    session.user.id,
    "expand_all_items_default",
    false
  );

  allSection.querySelector(".section-summary").textContent = `All items (${entries.length})`;
  // Strictly respects the setting — it previously also forced this open
  // whenever nothing matched the current site, which silently overrode an
  // explicit "off" and made the toggle look broken.
  allSection.open = expandByDefault;

  if (showAllItems) {
    for (const { site, activePassword } of rest) {
      allList.appendChild(buildEntryNode(site, activePassword, session, key, refresh, hintOnlyMode));
    }
  }
}

function generatePassword({ length, upper, numbers, symbols }) {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numberChars = "0123456789";
  const symbolChars = "!@#$%^&*()-_=+[]{}";

  let charset = lower;
  if (upper) charset += upperChars;
  if (numbers) charset += numberChars;
  if (symbols) charset += symbolChars;

  const randomValues = crypto.getRandomValues(new Uint32Array(length));
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

function estimatePasswordStrength(password) {
  if (!password) return { score: 0, label: "" };
  if (password.length < 8) return { score: 0.15, label: "Weak" };

  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/[0-9]/.test(password)) variety++;
  if (/[^a-zA-Z0-9]/.test(password)) variety++;

  const lengthScore = Math.min(password.length / 20, 1);
  const varietyScore = variety / 4;
  const score = lengthScore * 0.6 + varietyScore * 0.4;

  if (score < 0.45) return { score, label: "Weak" };
  if (score < 0.7) return { score, label: "Fair" };
  if (score < 0.85) return { score, label: "Good" };
  return { score, label: "Strong" };
}

const STRENGTH_COLORS = { Weak: "#b91c1c", Fair: "#e8a723", Good: "#146c2e", Strong: "#146c2e" };

async function showEntryForm(session, key, existing) {
  render("tpl-entry-form");

  const nameInput = app.querySelector("#form-site-name");
  const urlInput = app.querySelector("#form-site-url");
  const usernameInput = app.querySelector("#form-username");
  const passwordInput = app.querySelector("#form-password");
  const hintInput = app.querySelector("#form-hint");
  const errorEl = app.querySelector("#entry-form-error");

  const toggleVisibilityBtn = app.querySelector("#toggle-password-visibility");
  const strengthMeter = app.querySelector("#strength-meter");
  const strengthFill = app.querySelector("#strength-fill");
  const strengthLabel = app.querySelector("#strength-label");
  const genLengthInput = app.querySelector("#gen-length");
  const genLengthValue = app.querySelector("#gen-length-value");
  const genUpper = app.querySelector("#gen-upper");
  const genNumbers = app.querySelector("#gen-numbers");
  const genSymbols = app.querySelector("#gen-symbols");
  const genBtn = app.querySelector("#gen-generate-btn");

  const formKey = existing ? `edit:${existing.site.id}` : "add";
  let originalPassword = null;
  let originalHint = "";

  if (existing) {
    app.querySelector("#entry-form-title").textContent = "Edit entry";
    nameInput.value = existing.site.site_name;
    urlInput.value = existing.site.site_url;
    usernameInput.value = existing.site.username || "";

    // An entry whose ciphertext predates a master password change (or any
    // other key mismatch) throws here. Previously this was unguarded, so
    // the throw aborted showEntryForm() before it ever reached the
    // on("save-entry")/on("cancel-entry") registrations further down —
    // the form rendered, but every button on it was silently dead, with no
    // indication why. Catching it here means the form always finishes
    // wiring up regardless, and the user gets a specific, actionable path
    // out: type the real password and save over the broken ciphertext.
    try {
      originalPassword = await decryptEntry(key, existing.activePassword.encrypted_password);
      passwordInput.value = originalPassword;
    } catch (err) {
      console.error("Padlock: could not decrypt this entry's saved password", err);
      errorEl.textContent =
        "This entry's saved password can't be decrypted — it likely predates a master password change. Type the real password below and save to fix it.";
      errorEl.hidden = false;
    }

    if (existing.activePassword.encrypted_hint) {
      try {
        originalHint = await decryptEntry(key, existing.activePassword.encrypted_hint);
        hintInput.value = originalHint;
      } catch (err) {
        // Non-fatal: the hint is optional, so leave it blank rather than
        // block the whole form the way the unguarded password decrypt did.
        console.error("Padlock: could not decrypt this entry's saved hint", err);
      }
    }
  } else {
    const tab = await getActiveTab();
    const host = hostnameOf(tab?.url ?? "");

    if (host) {
      urlInput.value = host;
      nameInput.value = host
        .split(".")
        .slice(0, -1)
        .join(".")
        .replace(/^\w/, (c) => c.toUpperCase()) || host;
    }

    if (tab?.id) {
      try {
        const captured = await sendTabMessage(tab, { type: "PADLOCK_CAPTURE" });
        if (captured?.username) usernameInput.value = captured.username;
        if (captured?.password) passwordInput.value = captured.password;
      } catch {
        // Content script not injected on this tab (e.g. opened before install) — ignore.
      }
    }
  }

  const draft = await loadDraft(formKey);
  if (draft) {
    nameInput.value = draft.siteName ?? nameInput.value;
    urlInput.value = draft.siteUrl ?? urlInput.value;
    usernameInput.value = draft.username ?? usernameInput.value;
    passwordInput.value = draft.password ?? passwordInput.value;
    hintInput.value = draft.hint ?? hintInput.value;
    showToast("Restored your unsaved changes", "info");
  }

  if (!existing) {
    if (passwordInput.value) {
      nameInput.focus();
    } else {
      passwordInput.focus();
    }
  }

  let draftTimeout;
  function scheduleDraftSave() {
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
      saveDraft(formKey, {
        siteName: nameInput.value,
        siteUrl: urlInput.value,
        username: usernameInput.value,
        password: passwordInput.value,
        hint: hintInput.value,
      });
    }, 400);
  }

  [nameInput, urlInput, usernameInput, passwordInput, hintInput].forEach((input) =>
    input.addEventListener("input", scheduleDraftSave)
  );

  function updateStrengthMeter() {
    const { score, label } = estimatePasswordStrength(passwordInput.value);

    if (!passwordInput.value) {
      strengthMeter.hidden = true;
      return;
    }

    strengthMeter.hidden = false;
    strengthFill.style.width = `${Math.max(Math.round(score * 100), 8)}%`;
    strengthFill.style.background = STRENGTH_COLORS[label];
    strengthLabel.textContent = label;
    strengthLabel.style.color = STRENGTH_COLORS[label];
  }

  function setPasswordVisible(visible) {
    passwordInput.type = visible ? "text" : "password";
    toggleVisibilityBtn.textContent = visible ? "🙈" : "👁";
    toggleVisibilityBtn.title = visible ? "Hide password" : "Show password";
    toggleVisibilityBtn.classList.toggle("active", visible);
  }

  passwordInput.addEventListener("input", updateStrengthMeter);
  updateStrengthMeter();

  toggleVisibilityBtn.addEventListener("click", () => {
    setPasswordVisible(passwordInput.type === "password");
  });

  genLengthInput.addEventListener("input", () => {
    genLengthValue.textContent = genLengthInput.value;
  });

  genBtn.addEventListener("click", () => {
    passwordInput.value = generatePassword({
      length: Number(genLengthInput.value),
      upper: genUpper.checked,
      numbers: genNumbers.checked,
      symbols: genSymbols.checked,
    });
    setPasswordVisible(true);
    updateStrengthMeter();
  });

  on("cancel-entry", async () => {
    await clearDraft();
    showVault(session, key);
  });

  on("save-entry", async () => {
    errorEl.hidden = true;

    const siteName = nameInput.value.trim();
    const siteUrl = urlInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const hintValue = hintInput.value.trim();

    if (!siteName || !siteUrl || !password) {
      errorEl.textContent = "Site name, site URL, and password are required.";
      errorEl.hidden = false;
      return;
    }

    try {
      if (existing) {
        await updateSite(session.access_token, existing.site.id, { siteName, siteUrl, username });

        const passwordChanged = password !== originalPassword;
        const hintChanged = hintValue !== originalHint;

        if (passwordChanged || hintChanged) {
          const encryptedPassword = passwordChanged ? await encryptEntry(key, password) : null;
          const hintUpdate = hintChanged
            ? { included: true, value: hintValue ? await encryptEntry(key, hintValue) : null }
            : undefined;
          await updatePassword(
            session.access_token,
            existing.activePassword.id,
            encryptedPassword,
            hintUpdate
          );
        }
      } else {
        const encryptedPassword = await encryptEntry(key, password);
        const encryptedHint = hintValue ? await encryptEntry(key, hintValue) : null;
        const newSite = await createSite(session.access_token, session.user.id, {
          siteName,
          siteUrl,
          username,
        });
        await createPassword(
          session.access_token,
          session.user.id,
          newSite.id,
          encryptedPassword,
          encryptedHint
        );
      }

      await clearDraft();
      showToast(existing ? "Entry updated" : "Entry saved", "success");
      await showVault(session, key);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

boot();
