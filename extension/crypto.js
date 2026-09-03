// Zero-knowledge crypto helpers — ported from src/lib/crypto.ts. Native Web Crypto API only.

// Legacy fallback only — the extension never creates a vault itself (that
// happens on the website), so it always derives using the iteration count
// fetched from the user's row. This is used only if that column is somehow
// missing, matching the default in supabaseRest.js.
const LEGACY_PBKDF2_ITERATIONS = 250_000;
const VERIFIER_STRING = "PADLOCK_VERIFIER";

function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt);
}

async function deriveKey(masterPassword, salt, iterations = LEGACY_PBKDF2_ITERATIONS) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptEntry(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  };
}

async function decryptEntry(key, { iv, data }) {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(data)
  );

  return new TextDecoder().decode(plaintextBuffer);
}

async function createVerifier(key) {
  return encryptEntry(key, VERIFIER_STRING);
}

async function checkVerifier(key, verifier) {
  try {
    const decrypted = await decryptEntry(key, verifier);
    return decrypted === VERIFIER_STRING;
  } catch {
    return false;
  }
}

async function exportKeyRaw(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return Array.from(new Uint8Array(raw));
}

async function importKeyRaw(rawBytes) {
  return crypto.subtle.importKey("raw", new Uint8Array(rawBytes), { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}
