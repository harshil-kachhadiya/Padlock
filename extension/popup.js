const app = document.getElementById("app");

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

function showToast(message, variant = "info", action = null) {
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

  const duration = action ? 5000 : 2200;
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
  renderLoading("Checking session…");
  const session = await getSession();

  if (!session) {
    render("tpl-signin");
    on("sign-in", handleSignIn);
    return;
  }

  renderLoading("Loading your account…");
  const userRow = await fetchUserRow(session.access_token, session.user.id);

  if (!userRow) {
    render("tpl-no-vault");
    on("open-website", () => chrome.tabs.create({ url: PADLOCK_CONFIG.WEBSITE_URL }));
    on("sign-out", handleSignOut);
    return;
  }

  const cachedKey = await loadVaultKey();

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
    const key = await deriveKey(password, userRow.salt);
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

function buildEntryNode(site, activePassword, session, key, onChanged, matchReason) {
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
      const plaintext = await decryptEntry(key, activePassword.encrypted_password);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "PADLOCK_AUTOFILL",
        username: site.username,
        password: plaintext,
      });

      if (response?.ok) {
        const parts = [];
        if (response.filledUsername) parts.push("username");
        if (response.filledPassword) parts.push("password");
        showToast(`Filled ${parts.join(" & ")} for ${site.site_name}`, "success");
        button.textContent = "Filled";
      } else {
        showToast(`No login form found on this page for ${site.site_name}`, "error");
        button.textContent = "No form found";
      }
    } catch {
      showToast("Autofill failed — try reloading this tab", "error");
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
  on("sign-out", handleSignOut);
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

  if (!activeHost) {
    matchLabel.hidden = true;
    matchEmpty.hidden = true;
    allSection.hidden = false;
    allSection.open = true;
    allSection.querySelector(".section-summary").textContent = "All items";
    for (const { site, activePassword } of entries) {
      allList.appendChild(buildEntryNode(site, activePassword, session, key, refresh));
    }
    return;
  }

  const matching = entries.filter(({ site }) =>
    hostsMatch(activeHost, hostnameOf(`https://${site.site_url}`))
  );
  const rest = entries.filter((entry) => !matching.includes(entry));

  matchLabel.hidden = false;
  allSection.hidden = false;
  matchLabel.textContent = `This site (${activeHost})`;

  if (matching.length === 0) {
    matchEmpty.hidden = false;
  } else {
    for (const { site, activePassword } of matching) {
      const siteHost = hostnameOf(`https://${site.site_url}`);
      const reason =
        siteHost && siteHost !== activeHost ? `Saved for ${siteHost} — same domain` : null;
      matchList.appendChild(buildEntryNode(site, activePassword, session, key, refresh, reason));
    }
  }

  const expandByDefault = await fetchUserSetting(
    session.access_token,
    session.user.id,
    "expand_all_items_default",
    false
  );

  allSection.querySelector(".section-summary").textContent = `All items (${entries.length})`;
  allSection.open = matching.length === 0 || expandByDefault;

  for (const { site, activePassword } of rest) {
    allList.appendChild(buildEntryNode(site, activePassword, session, key, refresh));
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

  if (existing) {
    app.querySelector("#entry-form-title").textContent = "Edit entry";
    nameInput.value = existing.site.site_name;
    urlInput.value = existing.site.site_url;
    usernameInput.value = existing.site.username || "";
    originalPassword = await decryptEntry(key, existing.activePassword.encrypted_password);
    passwordInput.value = originalPassword;
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
        const captured = await chrome.tabs.sendMessage(tab.id, { type: "PADLOCK_CAPTURE" });
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
      });
    }, 400);
  }

  [nameInput, urlInput, usernameInput, passwordInput].forEach((input) =>
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

    if (!siteName || !siteUrl || !password) {
      errorEl.textContent = "Site name, site URL, and password are required.";
      errorEl.hidden = false;
      return;
    }

    try {
      if (existing) {
        await updateSite(session.access_token, existing.site.id, { siteName, siteUrl, username });
        if (password !== originalPassword) {
          const encryptedPassword = await encryptEntry(key, password);
          await updatePassword(session.access_token, existing.activePassword.id, encryptedPassword);
        }
      } else {
        const encryptedPassword = await encryptEntry(key, password);
        const newSite = await createSite(session.access_token, session.user.id, {
          siteName,
          siteUrl,
          username,
        });
        await createPassword(session.access_token, session.user.id, newSite.id, encryptedPassword);
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
