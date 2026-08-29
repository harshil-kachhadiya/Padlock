import { describe, it, expect } from "vitest";
import {
  generateSalt,
  deriveKey,
  encryptEntry,
  decryptEntry,
  createVerifier,
  checkVerifier,
} from "../crypto";

describe("crypto", () => {
  it("round-trips plaintext through encrypt/decrypt", async () => {
    const salt = generateSalt();
    const key = await deriveKey("correct horse battery staple", salt);

    const encrypted = await encryptEntry(key, "hunter2");
    const decrypted = await decryptEntry(key, encrypted);

    expect(decrypted).toBe("hunter2");
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const salt = generateSalt();
    const key = await deriveKey("password", salt);

    const a = await encryptEntry(key, "same-plaintext");
    const b = await encryptEntry(key, "same-plaintext");

    expect(a.data).not.toEqual(b.data);
    expect(a.iv).not.toEqual(b.iv);
  });

  it("derives the same key from the same password and salt", async () => {
    const salt = generateSalt();
    const keyA = await deriveKey("my-password", salt);
    const keyB = await deriveKey("my-password", salt);

    const encrypted = await encryptEntry(keyA, "shared-secret");
    const decrypted = await decryptEntry(keyB, encrypted);

    expect(decrypted).toBe("shared-secret");
  });

  it("fails to decrypt with a key derived from a different password", async () => {
    const salt = generateSalt();
    const rightKey = await deriveKey("right-password", salt);
    const wrongKey = await deriveKey("wrong-password", salt);

    const encrypted = await encryptEntry(rightKey, "top-secret");

    await expect(decryptEntry(wrongKey, encrypted)).rejects.toThrow();
  });

  it("verifier check passes for the correct password and fails for a wrong one", async () => {
    const salt = generateSalt();
    const correctKey = await deriveKey("master-password", salt);
    const wrongKey = await deriveKey("not-the-master-password", salt);

    const verifier = await createVerifier(correctKey);

    expect(await checkVerifier(correctKey, verifier)).toBe(true);
    expect(await checkVerifier(wrongKey, verifier)).toBe(false);
  });

  it("generates a 16-byte salt each time, non-repeating", () => {
    const a = generateSalt();
    const b = generateSalt();

    expect(a).toHaveLength(16);
    expect(b).toHaveLength(16);
    expect(a).not.toEqual(b);
  });
});
