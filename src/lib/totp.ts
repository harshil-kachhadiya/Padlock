// RFC 6238 TOTP using native Web Crypto (HMAC-SHA1) — no external dependency.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");

  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message as BufferSource);
  return new Uint8Array(signature);
}

export async function generateTotp(
  secretBase32: string,
  { period = 30, digits = 6, timestamp = Date.now() } = {}
): Promise<string> {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestamp / 1000 / period);

  const counterBytes = new Uint8Array(8);
  let remaining = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }

  const hmac = await hmacSha1(key, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function secondsRemainingInPeriod(period = 30, timestamp = Date.now()): number {
  return period - Math.floor((timestamp / 1000) % period);
}

export function isValidBase32Secret(value: string): boolean {
  const clean = value.replace(/\s+/g, "");
  return clean.length >= 8 && /^[A-Za-z2-7]+=*$/.test(clean);
}
