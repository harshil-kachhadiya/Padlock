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

let toastTimeout;
let toastHideTimeout;

function showToast(message, variant = "info") {
  const toast = document.getElementById("toast");
  clearTimeout(toastTimeout);
  clearTimeout(toastHideTimeout);

  toast.hidden = false;
  toast.textContent = message;
  toast.className = `toast${variant !== "info" ? ` toast-${variant}` : ""}`;

  requestAnimationFrame(() => toast.classList.add("show"));

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toastHideTimeout = setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 2200);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function getActiveTabUrl() {
  const tab = await getActiveTab();
  return tab?.url ?? "";
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Second-level suffixes where the registrable domain needs 3 labels, not 2
// (e.g. "example.co.uk", not just "co.uk"). Small pragmatic list, not a full PSL.
const TWO_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk",
  "co.in", "com.au", "co.nz", "co.za",
  "com.br", "com.cn", "co.jp", "co.kr",
]);

function registrableDomain(host) {
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join(".");
  if (TWO_LABEL_SUFFIXES.has(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function hostsMatch(a, b) {
  if (!a || !b) return false;
  return registrableDomain(a) === registrableDomain(b);
}

async function boot() {
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

    function updateCapsLockWarning(e) {
      capsLockWarning.hidden = !e.getModifierState?.("CapsLock");
    }

    passwordInput.addEventListener("keydown", (e) => {
      updateCapsLockWarning(e);
      if (e.key === "Enter") handleUnlock(session, userRow);
    });
    passwordInput.addEventListener("keyup", updateCapsLockWarning);

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

async function handleUnlock(session, userRow) {
  const passwordInput = app.querySelector("#unlock-password");
  const errorEl = app.querySelector("#unlock-error");
  const unlockBtn = app.querySelector('[data-action="unlock"]');
  const password = passwordInput.value;

  errorEl.hidden = true;
  unlockBtn.disabled = true;
  unlockBtn.textContent = "Unlocking…";

  try {
    const key = await deriveKey(password, userRow.salt);
    const valid = await checkVerifier(key, userRow.verifier);

    if (!valid) {
      errorEl.textContent = "Incorrect master password.";
      errorEl.hidden = false;
      unlockBtn.disabled = false;
      unlockBtn.textContent = "Unlock";
      return;
    }

    await storeVaultKey(key);
    await showVault(session, key);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Unlock";
  }
}

function buildEntryNode(site, activePassword, session, key, onChanged) {
  const entryTemplate = document.getElementById("tpl-entry");
  const node = entryTemplate.content.cloneNode(true);
  node.querySelector(".entry-name").textContent = site.site_name;
  node.querySelector(".entry-username").textContent = site.username || "";

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

  node.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
    if (!confirm(`Delete "${site.site_name}"? This cannot be undone from the extension.`)) return;

    const button = e.currentTarget;
    button.disabled = true;
    button.textContent = "Deleting…";

    try {
      await softDeleteSite(session.access_token, site.id);
      await onChanged();
    } catch (err) {
      alert(err.message);
      button.disabled = false;
      button.textContent = "Delete";
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
  const vaultLoading = app.querySelector("#vault-loading");

  matchLabel.hidden = true;
  matchEmpty.hidden = true;
  allSection.hidden = true;

  const activeUrl = await getActiveTabUrl();
  const activeHost = hostnameOf(activeUrl);

  const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
  vaultLoading.hidden = true;

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
      matchList.appendChild(buildEntryNode(site, activePassword, session, key, refresh));
    }
  }

  allSection.querySelector(".section-summary").textContent = `All items (${entries.length})`;
  allSection.open = matching.length === 0;

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

  if (existing) {
    app.querySelector("#entry-form-title").textContent = "Edit entry";
    nameInput.value = existing.site.site_name;
    urlInput.value = existing.site.site_url;
    usernameInput.value = existing.site.username || "";
    passwordInput.value = await decryptEntry(key, existing.activePassword.encrypted_password);
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

    if (passwordInput.value) {
      nameInput.focus();
    } else {
      passwordInput.focus();
    }
  }

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

  on("cancel-entry", () => showVault(session, key));

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
      const encryptedPassword = await encryptEntry(key, password);

      if (existing) {
        await updateSite(session.access_token, existing.site.id, { siteName, siteUrl, username });
        await updatePassword(session.access_token, existing.activePassword.id, encryptedPassword);
      } else {
        const newSite = await createSite(session.access_token, session.user.id, {
          siteName,
          siteUrl,
          username,
        });
        await createPassword(session.access_token, session.user.id, newSite.id, encryptedPassword);
      }

      await showVault(session, key);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

boot();
