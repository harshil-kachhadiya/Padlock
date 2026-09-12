// Thin REST wrapper over Supabase PostgREST — RLS scopes every query to the caller automatically.

function restHeaders(accessToken) {
  return {
    apikey: PADLOCK_CONFIG.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchUserRow(accessToken, userId) {
  const url = `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/users?id=eq.${userId}&deleted=eq.false&select=salt,verifier,pbkdf2_iterations`;
  const res = await fetch(url, { headers: restHeaders(accessToken) });
  if (!res.ok) throw new Error("Failed to load vault.");
  const rows = await res.json();
  return rows[0] ?? null;
}

async function fetchSitesWithPasswords(accessToken, userId) {
  const url =
    `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/sites` +
    `?user_id=eq.${userId}&deleted=eq.false` +
    `&select=id,site_name,site_url,username,passwords(id,encrypted_password,encrypted_hint,created_at,deleted)`;

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

async function createPassword(accessToken, userId, siteId, encryptedPassword, encryptedHint) {
  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/passwords`, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: JSON.stringify({
      site_id: siteId,
      user_id: userId,
      encrypted_password: encryptedPassword,
      encrypted_hint: encryptedHint || null,
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

async function updatePassword(accessToken, passwordId, encryptedPassword, hintUpdate) {
  const body = { updated_at: new Date().toISOString() };
  if (encryptedPassword) body.encrypted_password = encryptedPassword;
  // hintUpdate: { included: true, value: <payload | null> } — distinguishes
  // "clear the hint" from "leave it as-is", same convention as the website API.
  if (hintUpdate?.included) body.encrypted_hint = hintUpdate.value;

  const res = await fetch(`${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/passwords?id=eq.${passwordId}`, {
    method: "PATCH",
    headers: restHeaders(accessToken),
    body: JSON.stringify(body),
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

async function fetchUserSetting(accessToken, userId, key, defaultValue) {
  try {
    const url =
      `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/user_settings` +
      `?user_id=eq.${userId}&setting_key=eq.${key}&select=value`;

    const res = await fetch(url, { headers: restHeaders(accessToken) });
    if (!res.ok) return defaultValue;

    const rows = await res.json();
    return rows.length > 0 ? rows[0].value : defaultValue;
  } catch {
    return defaultValue;
  }
}

async function updateUserSetting(accessToken, userId, key, value) {
  const url =
    `${PADLOCK_CONFIG.SUPABASE_URL}/rest/v1/user_settings` +
    `?on_conflict=user_id,setting_key`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...restHeaders(accessToken),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      setting_key: key,
      value,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    let detail = "Failed to save setting.";
    try {
      const body = await res.json();
      if (body.message || body.details || body.hint) {
        detail = [body.message, body.details, body.hint].filter(Boolean).join(" ");
      }
    } catch {
      // Keep the generic message if the server did not return JSON.
    }
    throw new Error(detail);
  }
}
