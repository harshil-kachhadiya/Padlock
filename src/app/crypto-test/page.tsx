"use client";

import { useState } from "react";
import {
  generateSalt,
  deriveKey,
  encryptEntry,
  decryptEntry,
  createVerifier,
  checkVerifier,
} from "@/lib/crypto";

export default function CryptoTestPage() {
  const [password, setPassword] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [encrypted, setEncrypted] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [verifierMatch, setVerifierMatch] = useState<string>("");

  async function runTest() {
    const salt = generateSalt();
    const key = await deriveKey(password, salt);

    const encryptedPayload = await encryptEntry(key, plaintext);
    setEncrypted(JSON.stringify(encryptedPayload));

    const decryptedText = await decryptEntry(key, encryptedPayload);
    setDecrypted(decryptedText);

    const verifier = await createVerifier(key);
    const correctMatch = await checkVerifier(key, verifier);

    const wrongKey = await deriveKey(password + "x", salt);
    const wrongMatch = await checkVerifier(wrongKey, verifier);

    setVerifierMatch(
      `correct password -> ${correctMatch}, wrong password -> ${wrongMatch}`
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 600 }}>
      <h1>Padlock crypto.ts manual test</h1>

      <div style={{ marginTop: 16 }}>
        <label>Master password</label>
        <br />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Plaintext to encrypt</label>
        <br />
        <input
          type="text"
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <button onClick={runTest} style={{ marginTop: 16, padding: "8px 16px" }}>
        Encrypt then decrypt
      </button>

      <div style={{ marginTop: 24 }}>
        <p><strong>Encrypted payload:</strong></p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{encrypted}</pre>

        <p><strong>Decrypted result:</strong></p>
        <pre>{decrypted}</pre>

        <p><strong>Verifier check:</strong></p>
        <pre>{verifierMatch}</pre>
      </div>
    </div>
  );
}
