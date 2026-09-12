// Supabase auth over plain fetch — no SDK bundling needed for a Manifest V3 extension.

const PADLOCK_SESSION_KEY = "padlock_session"; // chrome.storage.local: { access_token, refresh_token, expires_at, user }
const PADLOCK_VAULT_KEY = "padlock_vault_key"; // { rawKey: number[], unlockedAt: number }
const PADLOCK_DRAFT_KEY = "padlock_draft"; // { formKey, siteName, siteUrl, username, password, savedAt }
const PADLOCK_BROWSER_LOCK_KEY = "padlock_browser_lock";
const PADLOCK_BROWSER_UNLOCKED_KEY = "padlock_browser_unlocked";

async function signInWithGoogle() {
  const redirectUrl = chrome.identity.getRedirectURL();
  const authorizeUrl =
    `${PADLOCK_CONFIG.SUPABASE_URL}/auth/v1/authorize` +
    `?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizeUrl,
    interactive: true,
  });

  const hash = new URL(responseUrl).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_in = Number(params.get("expires_in") ?? "3600");

  if (!access_token || !refresh_token) {
    const errorDescription = params.get("error_description") || "No tokens returned from Supabase.";
    throw new Error(errorDescription);
  }

  const user = await fetchAuthedUser(access_token);
  const session = {
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000,
    user,
  };

  await chrome.storage.local.set({ [PADLOCK_SESSION_KEY]: session });
  return session;
}

async function fetchAuthedUser(accessToken) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: PADLOCK_CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch user.");
  return res.json();
}

async function refreshSession(session) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: PADLOCK_CONFIG.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!res.ok) {
    await chrome.storage.local.remove(PADLOCK_SESSION_KEY);
    return null;
  }

  const data = await res.json();
  if (!data.access_token) {
    await chrome.storage.local.remove(PADLOCK_SESSION_KEY);
    return null;
  }

  const refreshed = {
    access_token: data.access_token,
    // Supabase rotates refresh tokens. Always persist the newly returned
    // token, while retaining the old one only for providers that omit it.
    refresh_token: data.refresh_token || session.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    user: session.user,
  };

  await chrome.storage.local.set({ [PADLOCK_SESSION_KEY]: refreshed });
  return refreshed;
}

async function getSession() {
  const stored = await chrome.storage.local.get(PADLOCK_SESSION_KEY);
  const session = stored[PADLOCK_SESSION_KEY];
  if (!session) return null;

  if (!session.access_token || !session.refresh_token || !session.expires_at) {
    await chrome.storage.local.remove(PADLOCK_SESSION_KEY);
    return null;
  }

  if (Date.now() > session.expires_at - 60_000) {
    return refreshSession(session);
  }

  return session;
}

async function signOut() {
  await chrome.storage.local.remove([
    PADLOCK_SESSION_KEY,
    PADLOCK_VAULT_KEY,
    PADLOCK_BROWSER_LOCK_KEY,
  ]);
  await clearBrowserUnlock();
}

async function storeVaultKey(cryptoKey) {
  const rawKey = await exportKeyRaw(cryptoKey);
  await chrome.storage.local.set({
    [PADLOCK_VAULT_KEY]: { rawKey, unlockedAt: Date.now() },
  });
}

async function loadVaultKey() {
  const stored = await chrome.storage.local.get(PADLOCK_VAULT_KEY);
  const entry = stored[PADLOCK_VAULT_KEY];
  if (!entry) return null;

  return importKeyRaw(entry.rawKey);
}

async function clearVaultKey() {
  await chrome.storage.local.remove(PADLOCK_VAULT_KEY);
}

async function getBrowserLockConfig() {
  const stored = await chrome.storage.local.get(PADLOCK_BROWSER_LOCK_KEY);
  return stored[PADLOCK_BROWSER_LOCK_KEY] || null;
}

async function configureBrowserLock(password, mode, iterations = LEGACY_PBKDF2_ITERATIONS) {
  if (mode === "master") {
    await chrome.storage.local.set({ [PADLOCK_BROWSER_LOCK_KEY]: { mode } });
    await markBrowserUnlocked();
    return;
  }

  const salt = generateSalt();
  const key = await deriveKey(password, salt, iterations);
  const verifier = await createVerifier(key);
  await chrome.storage.local.set({
    [PADLOCK_BROWSER_LOCK_KEY]: { mode, salt, iterations, verifier },
  });
  await markBrowserUnlocked();
}

async function markBrowserUnlocked() {
  await chrome.storage.session.set({ [PADLOCK_BROWSER_UNLOCKED_KEY]: true });
}

async function clearBrowserUnlock() {
  await chrome.storage.session.remove(PADLOCK_BROWSER_UNLOCKED_KEY);
}

async function isBrowserUnlocked() {
  const stored = await chrome.storage.session.get(PADLOCK_BROWSER_UNLOCKED_KEY);
  return stored[PADLOCK_BROWSER_UNLOCKED_KEY] === true;
}

async function verifyBrowserPassword(password) {
  const config = await getBrowserLockConfig();
  if (!config) return false;
  if (config.mode === "master") {
    const session = await getSession();
    if (!session) return false;
    const userRow = await fetchUserRow(session.access_token, session.user.id);
    if (!userRow) return false;
    const key = await deriveKey(password, userRow.salt, userRow.pbkdf2_iterations ?? 250_000);
    return checkVerifier(key, userRow.verifier);
  }
  if (!config.salt || !config.verifier) return false;
  const key = await deriveKey(password, config.salt, config.iterations);
  return checkVerifier(key, config.verifier);
}

// Draft recovery for the Add/Edit form — kept only in memory (chrome.storage.session),
// same tier of protection as the cached vault key, never written to disk.
async function saveDraft(formKey, fields) {
  await chrome.storage.session.set({
    [PADLOCK_DRAFT_KEY]: { formKey, ...fields, savedAt: Date.now() },
  });
}

async function loadDraft(formKey) {
  const stored = await chrome.storage.session.get(PADLOCK_DRAFT_KEY);
  const draft = stored[PADLOCK_DRAFT_KEY];
  if (!draft || draft.formKey !== formKey) return null;
  return draft;
}

async function clearDraft() {
  await chrome.storage.session.remove(PADLOCK_DRAFT_KEY);
}

// --- Unlock lockout ---------------------------------------------------
// Soft rate-limit against repeated failed unlock attempts, mirroring the
// website's version. Uses chrome.storage.local (not .session) so it
// survives browser restarts, not just the current browser session.

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_BASE_MS = 30_000;

function lockoutKey(userId) {
  return `padlock_lockout_${userId}`;
}

async function loadLockoutState(userId) {
  const stored = await chrome.storage.local.get(lockoutKey(userId));
  return stored[lockoutKey(userId)] || { attempts: 0, lockedUntil: 0, lockoutTier: 0 };
}

async function recordFailedAttempt(userId) {
  const state = await loadLockoutState(userId);
  state.attempts += 1;

  if (state.attempts >= LOCKOUT_MAX_ATTEMPTS) {
    state.lockoutTier += 1;
    state.lockedUntil = Date.now() + LOCKOUT_BASE_MS * 2 ** (state.lockoutTier - 1);
    state.attempts = 0;
  }

  await chrome.storage.local.set({ [lockoutKey(userId)]: state });
  return state;
}

async function recordUnlockSuccess(userId) {
  await chrome.storage.local.set({
    [lockoutKey(userId)]: { attempts: 0, lockedUntil: 0, lockoutTier: 0 },
  });
}

function lockoutAttemptsRemaining(state) {
  return Math.max(LOCKOUT_MAX_ATTEMPTS - state.attempts, 0);
}

function isLockedOut(state) {
  return Date.now() < state.lockedUntil;
}

function secondsUntilUnlocked(state) {
  return Math.max(Math.ceil((state.lockedUntil - Date.now()) / 1000), 0);
}
