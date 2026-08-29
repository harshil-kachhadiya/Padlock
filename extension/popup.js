const app = document.getElementById("app");

function render(templateId) {
  const template = document.getElementById(templateId);
  app.replaceChildren(template.content.cloneNode(true));
}

function on(action, handler) {
  const el = app.querySelector(`[data-action="${action}"]`);
  if (el) el.addEventListener("click", handler);
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

async function boot() {
  const session = await getSession();

  if (!session) {
    render("tpl-signin");
    on("sign-in", handleSignIn);
    return;
  }

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
    app.querySelector("#unlock-password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUnlock(session, userRow);
    });
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
  const password = passwordInput.value;

  errorEl.hidden = true;

  try {
    const key = await deriveKey(password, userRow.salt);
    const valid = await checkVerifier(key, userRow.verifier);

    if (!valid) {
      errorEl.textContent = "Incorrect master password.";
      errorEl.hidden = false;
      return;
    }

    await storeVaultKey(key);
    await showVault(session, key);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function showVault(session, key) {
  render("tpl-vault");
  on("lock", async () => {
    await clearVaultKey();
    await boot();
  });
  on("sign-out", handleSignOut);
  on("add-entry", () => showEntryForm(session, key, null));

  const list = app.querySelector("#entry-list");
  const emptyMsg = app.querySelector("#vault-empty");
  const activeUrl = await getActiveTabUrl();
  const activeHost = hostnameOf(activeUrl);

  const sites = await fetchSitesWithPasswords(session.access_token, session.user.id);

  if (sites.length === 0) {
    emptyMsg.hidden = false;
    return;
  }

  const entryTemplate = document.getElementById("tpl-entry");

  const sorted = [...sites].sort((a, b) => {
    const aMatch = hostnameOf(`https://${a.site_url}`).includes(activeHost) ? 0 : 1;
    const bMatch = hostnameOf(`https://${b.site_url}`).includes(activeHost) ? 0 : 1;
    return aMatch - bMatch;
  });

  for (const site of sorted) {
    const activePassword = (site.passwords || [])
      .filter((p) => !p.deleted)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

    if (!activePassword) continue;

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

        button.textContent = response?.ok ? "Filled" : "No form found";
      } catch {
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
        await showVault(session, key);
      } catch (err) {
        alert(err.message);
        button.disabled = false;
        button.textContent = "Delete";
      }
    });

    list.appendChild(node);
  }
}

async function showEntryForm(session, key, existing) {
  render("tpl-entry-form");

  const nameInput = app.querySelector("#form-site-name");
  const urlInput = app.querySelector("#form-site-url");
  const usernameInput = app.querySelector("#form-username");
  const passwordInput = app.querySelector("#form-password");
  const errorEl = app.querySelector("#entry-form-error");

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
