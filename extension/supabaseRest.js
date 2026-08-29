// Thin REST wrapper over Supabase PostgREST — RLS scopes every query to the caller automatically.

function restHeaders(accessToken) {
  return {
    apikey: PADLOCK_CONFIG.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchUserRow(accessToken, userId) {
  const url = `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/users?id=eq.${userId}&deleted=eq.false&select=salt,verifier`;
  const res = await fetch(url, { headers: restHeaders(accessToken) });
  if (!res.ok) throw new Error("Failed to load vault.");
  const rows = await res.json();
  return rows[0] ?? null;
}

async function fetchSitesWithPasswords(accessToken, userId) {
  const url =
    `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/sites` +
    `?user_id=eq.${userId}&deleted=eq.false` +
    `&select=id,site_name,site_url,username,passwords(id,encrypted_password,created_at,deleted)`;

  const res = await fetch(url, { headers: restHeaders(accessToken) });
  if (!res.ok) throw new Error("Failed to load entries.");
  return res.json();
}

async function createSite(accessToken, userId, { siteName, siteUrl, username }) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/sites`, {
    method: "POST",
    headers: { ...restHeaders(accessToken), Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      site_name: siteName,
      site_url: siteUrl,
      username: username || null,
    }),
  });

  if (!res.ok) throw new Error("Failed to create site.");
  const rows = await res.json();
  return rows[0];
}

async function createPassword(accessToken, userId, siteId, encryptedPassword) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/passwords`, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: JSON.stringify({
      site_id: siteId,
      user_id: userId,
      encrypted_password: encryptedPassword,
    }),
  });

  if (!res.ok) throw new Error("Failed to save password.");
}

async function updateSite(accessToken, siteId, { siteName, siteUrl, username }) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/sites?id=eq.${siteId}`, {
    method: "PATCH",
    headers: restHeaders(accessToken),
    body: JSON.stringify({ site_name: siteName, site_url: siteUrl, username: username || null }),
  });

  if (!res.ok) throw new Error("Failed to update site.");
}

async function updatePassword(accessToken, passwordId, encryptedPassword) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/passwords?id=eq.${passwordId}`, {
    method: "PATCH",
    headers: restHeaders(accessToken),
    body: JSON.stringify({
      encrypted_password: encryptedPassword,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) throw new Error("Failed to update password.");
}

async function softDeleteSite(accessToken, siteId) {
  const siteRes = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/sites?id=eq.${siteId}`, {
    method: "PATCH",
    headers: restHeaders(accessToken),
    body: JSON.stringify({ deleted: true }),
  });

  if (!siteRes.ok) throw new Error("Failed to delete site.");

  const passwordRes = await fetch(
    `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/passwords?site_id=eq.${siteId}`,
    {
      method: "PATCH",
      headers: restHeaders(accessToken),
      body: JSON.stringify({ deleted: true }),
    }
  );

  if (!passwordRes.ok) throw new Error("Failed to delete password.");
}

async function undoDeleteSite(accessToken, siteId) {
  const siteRes = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/sites?id=eq.${siteId}`, {
    method: "PATCH",
    headers: restHeaders(accessToken),
    body: JSON.stringify({ deleted: false }),
  });

  if (!siteRes.ok) throw new Error("Failed to restore site.");

  const passwordRes = await fetch(
    `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/passwords?site_id=eq.${siteId}`,
    {
      method: "PATCH",
      headers: restHeaders(accessToken),
      body: JSON.stringify({ deleted: false }),
    }
  );

  if (!passwordRes.ok) throw new Error("Failed to restore password.");
}
