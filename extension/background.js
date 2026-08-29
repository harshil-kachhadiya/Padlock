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

chrome.tabs.onActivated.addListener(rebuildMenuForActiveTab);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) rebuildMenuForTab(tab);
});
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "session") rebuildMenuForActiveTab();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Padlock extension installed.");
  rebuildMenuForActiveTab();
});
chrome.runtime.onStartup.addListener(rebuildMenuForActiveTab);
