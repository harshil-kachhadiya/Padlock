/**
 * Educational demo of Padlock's master-password verification, using the exact
 * algorithm in src/lib/crypto.ts (PBKDF2 -> AES-256-GCM, 250,000 iterations).
 *
 * This does NOT recover a password from a salt/verifier — that is not
 * mathematically possible without brute-forcing candidates, which this script
 * deliberately does not do. Instead it demonstrates the real flow end-to-end
 * with a password you choose, so you can see why a correct guess unlocks and
 * an incorrect one fails outright with no partial credit.
 *
 * Run: node scripts/demo-verifier.mjs "some password" "wrong guess"
 */
import { webcrypto as crypto } from "crypto";

const PBKDF2_ITERATIONS = 250_000;
const VERIFIER_STRING = "PADLOCK_VERIFIER";

async function deriveKey(masterPassword, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function createVerifier(key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(VERIFIER_STRING)
  );
  return { iv, data: new Uint8Array(data) };
}

async function checkVerifier(key, { iv, data }) {
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plaintext) === VERIFIER_STRING;
  } catch {
    return false; // wrong key -> GCM auth tag fails -> hard rejection, no partial match
  }
}

const [, , correctPassword = "correct horse battery staple", wrongPassword = "wrong guess"] =
  process.argv;

const salt = crypto.getRandomValues(new Uint8Array(16));

console.log("--- setup (what happens once, when you set your master password) ---");
console.log("salt (stored, not secret):", Buffer.from(salt).toString("hex"));

const t0 = performance.now();
const realKey = await deriveKey(correctPassword, salt);
const oneDeriveMs = performance.now() - t0;
const verifier = await createVerifier(realKey);
console.log(`derived key from "${correctPassword}" in ${oneDeriveMs.toFixed(1)}ms`);
console.log("verifier (stored):", {
  iv: Array.from(verifier.iv),
  data: Array.from(verifier.data).slice(0, 8).join(",") + "...",
});

console.log("\n--- unlock attempt #1: correct password ---");
const key1 = await deriveKey(correctPassword, salt);
console.log(`"${correctPassword}" ->`, (await checkVerifier(key1, verifier)) ? "UNLOCKS" : "rejected");

console.log("\n--- unlock attempt #2: wrong password ---");
const key2 = await deriveKey(wrongPassword, salt);
console.log(`"${wrongPassword}" ->`, (await checkVerifier(key2, verifier)) ? "UNLOCKS" : "rejected");

console.log("\n--- why brute force is impractical ---");
const guessesPerSecond = 1000 / oneDeriveMs;
const keyspace = Math.pow(62, 10); // rough: 10-char alphanumeric password
const seconds = keyspace / guessesPerSecond;
const years = seconds / (60 * 60 * 24 * 365);
console.log(`this machine: ~${guessesPerSecond.toFixed(1)} guesses/sec (250,000 PBKDF2 iterations each)`);
console.log(`a 10-char alphanumeric password has ~${keyspace.toExponential(2)} possibilities`);
console.log(`brute-forcing all of them here: ~${years.toExponential(2)} years`);
