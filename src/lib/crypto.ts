// Zero-knowledge crypto helpers. Native Web Crypto API only — no external crypto packages.

const PBKDF2_ITERATIONS = 250_000;
const VERIFIER_STRING = "PADLOCK_VERIFIER";

export type EncryptedPayload = {
  iv: number[];
  data: number[];
};

export function generateSalt(): number[] {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt);
}

export async function deriveKey(
  masterPassword: string,
  salt: number[]
): Promise<CryptoKey> {
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
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptEntry(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  };
}

export async function decryptEntry(
  key: CryptoKey,
  { iv, data }: EncryptedPayload
): Promise<string> {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(data)
  );

  return new TextDecoder().decode(plaintextBuffer);
}

export async function createVerifier(key: CryptoKey): Promise<EncryptedPayload> {
  return encryptEntry(key, VERIFIER_STRING);
}

export async function checkVerifier(
  key: CryptoKey,
  verifier: EncryptedPayload
): Promise<boolean> {
  try {
    const decrypted = await decryptEntry(key, verifier);
    return decrypted === VERIFIER_STRING;
  } catch {
    return false;
  }
}
