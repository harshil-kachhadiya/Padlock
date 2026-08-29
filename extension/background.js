// Service worker: builds a per-tab "Fill with Padlock" right-click menu so
// autofill doesn't require opening the popup at all.

importScripts("config.js", "domainMatch.js", "crypto.js", "auth.js", "supabaseRest.js");

const MENU_ROOT_ID = "padlock-root";

function activeEntriesForHost(allSites, activeHost) {
  return allSites
    .map((site) => {
      const activePassword = (site.passwords || [])
        .filter((p) => !p.deleted)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      return activePassword ? { site, activePassword } : null;
    })
    .filter(Boolean)
    .filter(({ site }) => hostsMatch(activeHost, hostnameOf(`https://${site.site_url}`)));
}

async function rebuildMenuForTab(tab) {
  await chrome.contextMenus.removeAll();

  if (!tab?.url || !/^https?:/.test(tab.url)) return;

  chrome.contextMenus.create({
    id: MENU_ROOT_ID,
    title: "Fill with Padlock",
    contexts: ["editable"],
  });

  try {
    const session = await getSession();
    if (!session) {
      chrome.contextMenus.create({
        id: "padlock-signin-needed",
        parentId: MENU_ROOT_ID,
        title: "Sign in from the Padlock popup",
        contexts: ["editable"],
        enabled: false,
      });
      return;
    }

    const vaultKey = await loadVaultKey();
    if (!vaultKey) {
      chrome.contextMenus.create({
        id: "padlock-locked",
        parentId: MENU_ROOT_ID,
        title: "Vault locked — unlock from the popup",
        contexts: ["editable"],
        enabled: false,
      });
      return;
    }

    const activeHost = hostnameOf(tab.url);
    const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
    const entries = activeEntriesForHost(allSites, activeHost);

    if (entries.length === 0) {
      chrome.contextMenus.create({
        id: "padlock-none",
        parentId: MENU_ROOT_ID,
        title: "No saved entries for this site",
        contexts: ["editable"],
        enabled: false,
      });
      return;
    }

    for (const { site } of entries) {
      chrome.contextMenus.create({
        id: `padlock-fill-${site.id}`,
        parentId: MENU_ROOT_ID,
        title: site.username ? `${site.site_name} (${site.username})` : site.site_name,
        contexts: ["editable"],
      });
    }
  } catch {
    chrome.contextMenus.create({
      id: "padlock-error",
      parentId: MENU_ROOT_ID,
      title: "Couldn't load entries — try the popup",
      contexts: ["editable"],
      enabled: false,
    });
  }
}

async function rebuildMenuForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) rebuildMenuForTab(tab);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.menuItemId.startsWith("padlock-fill-")) return;

  const siteId = info.menuItemId.replace("padlock-fill-", "");

  try {
    const session = await getSession();
    const vaultKey = await loadVaultKey();
    if (!session || !vaultKey) return;

    const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
    const site = allSites.find((s) => s.id === siteId);
    if (!site) return;

    const activePassword = (site.passwords || [])
      .filter((p) => !p.deleted)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    if (!activePassword) return;

    const plaintext = await decryptEntry(vaultKey, activePassword.encrypted_password);

    chrome.tabs.sendMessage(tab.id, {
      type: "PADLOCK_AUTOFILL",
      username: site.username,
      password: plaintext,
    });
  } catch {
    // Silently fail — the popup remains the reliable fallback for autofill.
  }
});

// --- Save-prompt on form submit ------------------------------------------
// Content script captures a submitted login form; we stash it per-tab (memory
// only) so the NEXT page load on that same tab (post-redirect) can pick it up
// and decide whether to show a "Save this password?" banner.

const IGNORED_HOSTS_KEY = "padlock_ignored_hosts"; // chrome.storage.local: string[]
const PENDING_CAPTURE_PREFIX = "padlock_pending_capture_"; // + tabId, chrome.storage.session
const PENDING_CAPTURE_TTL_MS = 20_000;

async function getIgnoredHosts() {
  const stored = await chrome.storage.local.get(IGNORED_HOSTS_KEY);
  return stored[IGNORED_HOSTS_KEY] || [];
}

async function addIgnoredHost(host) {
  const hosts = await getIgnoredHosts();
  if (!hosts.includes(host)) {
    await chrome.storage.local.set({ [IGNORED_HOSTS_KEY]: [...hosts, host] });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PADLOCK_CAPTURE_SUBMIT") {
    const tabId = sender.tab?.id;
    if (tabId == null) return;

    chrome.storage.session.set({
      [`${PENDING_CAPTURE_PREFIX}${tabId}`]: {
        username: message.username,
        password: message.password,
        host: message.host,
        capturedAt: Date.now(),
      },
    });
    return;
  }

  if (message?.type === "PADLOCK_GET_PENDING_CAPTURE") {
    (async () => {
      const tabId = sender.tab?.id;
      if (tabId == null) return sendResponse(null);

      const storageKey = `${PENDING_CAPTURE_PREFIX}${tabId}`;
      const stored = await chrome.storage.session.get(storageKey);
      const capture = stored[storageKey];
      await chrome.storage.session.remove(storageKey);

      if (!capture) return sendResponse(null);
      if (Date.now() - capture.capturedAt > PENDING_CAPTURE_TTL_MS) return sendResponse(null);
      if (!hostsMatch(capture.host, message.currentHost)) return sendResponse(null);

      const ignored = await getIgnoredHosts();
      if (ignored.some((h) => hostsMatch(h, capture.host))) return sendResponse(null);

      sendResponse(capture);
    })();
    return true;
  }

  if (message?.type === "PADLOCK_CHECK_SHOULD_PROMPT") {
    (async () => {
      try {
        const session = await getSession();
        const vaultKey = await loadVaultKey();
        if (!session || !vaultKey) return sendResponse({ show: false });

        const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
        const candidates = activeEntriesForHost(allSites, message.host).filter(
          ({ site }) => (site.username || "") === (message.username || "")
        );

        for (const { activePassword } of candidates) {
          const existingPlain = await decryptEntry(vaultKey, activePassword.encrypted_password);
          if (existingPlain === message.password) return sendResponse({ show: false });
        }

        sendResponse({ show: true, isUpdate: candidates.length > 0 });
      } catch {
        sendResponse({ show: false });
      }
    })();
    return true;
  }

  if (message?.type === "PADLOCK_SAVE_CAPTURE") {
    (async () => {
      try {
        const session = await getSession();
        const vaultKey = await loadVaultKey();
        if (!session || !vaultKey) {
          return sendResponse({ ok: false, error: "Vault is locked." });
        }

        const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
        const existing = activeEntriesForHost(allSites, message.host).find(
          ({ site }) => (site.username || "") === (message.username || "")
        );

        const encryptedPassword = await encryptEntry(vaultKey, message.password);

        if (existing) {
          await updatePassword(session.access_token, existing.activePassword.id, encryptedPassword);
        } else {
          const siteName =
            message.host.split(".").slice(0, -1).join(".").replace(/^\w/, (c) => c.toUpperCase()) ||
            message.host;

          const newSite = await createSite(session.access_token, session.user.id, {
            siteName,
            siteUrl: message.host,
            username: message.username,
          });
          await createPassword(session.access_token, session.user.id, newSite.id, encryptedPassword);
        }

        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message?.type === "PADLOCK_IGNORE_HOST") {
    (async () => {
      await addIgnoredHost(message.host);
      sendResponse({ ok: true });
    })();
    return true;
  }

  // --- Click-to-see-saved-logins dropdown ---------------------------------

  if (message?.type === "PADLOCK_LIST_ENTRIES_FOR_HOST") {
    (async () => {
      try {
        const session = await getSession();
        if (!session) return sendResponse({ status: "signed-out", entries: [] });

        const vaultKey = await loadVaultKey();
        if (!vaultKey) return sendResponse({ status: "locked", entries: [] });

        const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
        const entries = activeEntriesForHost(allSites, message.host).map(({ site }) => ({
          id: site.id,
          siteName: site.site_name,
          username: site.username || "",
        }));

        sendResponse({ status: "ok", entries });
      } catch {
        sendResponse({ status: "error", entries: [] });
      }
    })();
    return true;
  }

  if (message?.type === "PADLOCK_GET_CREDENTIALS") {
    (async () => {
      try {
        const session = await getSession();
        const vaultKey = await loadVaultKey();
        if (!session || !vaultKey) {
          return sendResponse({ ok: false, error: "Vault is locked." });
        }

        const allSites = await fetchSitesWithPasswords(session.access_token, session.user.id);
        const site = allSites.find((s) => s.id === message.siteId);
        if (!site) return sendResponse({ ok: false, error: "Entry not found." });

        const activePassword = (site.passwords || [])
          .filter((p) => !p.deleted)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        if (!activePassword) return sendResponse({ ok: false, error: "Entry not found." });

        const password = await decryptEntry(vaultKey, activePassword.encrypted_password);
        sendResponse({ ok: true, username: site.username || "", password });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});

chrome.tabs.onActivated.addListener(rebuildMenuForActiveTab);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) rebuildMenuForTab(tab);
});
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "session") rebuildMenuForActiveTab();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("Padlock extension installed.");
  rebuildMenuForActiveTab();

  chrome.runtime.setUninstallURL(`${PADLOCK_CONFIG.WEBSITE_URL}/extension/goodbye`);

  if (details.reason === "install") {
    // New install: the vault may not exist yet, so send them to the landing
    // page (sign in → set up) rather than /welcome, which assumes it does.
    chrome.tabs.create({ url: `${PADLOCK_CONFIG.WEBSITE_URL}/` });
  }
});
chrome.runtime.onStartup.addListener(rebuildMenuForActiveTab);
