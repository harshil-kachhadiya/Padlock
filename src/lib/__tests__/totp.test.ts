import { describe, it, expect } from "vitest";
import { generateTotp, secondsRemainingInPeriod, isValidBase32Secret } from "../totp";

// RFC 6238 Appendix B test vectors use the ASCII secret "12345678901234567890"
// for SHA-1, base32-encoded as below.
const RFC_6238_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("matches the official RFC 6238 test vectors", async () => {
    expect(await generateTotp(RFC_6238_SECRET, { timestamp: 59 * 1000 })).toBe("287082");
    expect(await generateTotp(RFC_6238_SECRET, { timestamp: 1111111109 * 1000 })).toBe("081804");
    expect(await generateTotp(RFC_6238_SECRET, { timestamp: 1111111111 * 1000 })).toBe("050471");
    expect(await generateTotp(RFC_6238_SECRET, { timestamp: 1234567890 * 1000 })).toBe("005924");
  });

  it("produces a stable code within the same 30s period", async () => {
    const a = await generateTotp(RFC_6238_SECRET, { timestamp: 1000 });
    const b = await generateTotp(RFC_6238_SECRET, { timestamp: 29000 });
    expect(a).toBe(b);
  });

  it("changes code across a period boundary", async () => {
    const a = await generateTotp(RFC_6238_SECRET, { timestamp: 29000 });
    const b = await generateTotp(RFC_6238_SECRET, { timestamp: 31000 });
    expect(a).not.toBe(b);
  });

  it("reports seconds remaining within [0, 30]", () => {
    const seconds = secondsRemainingInPeriod(30, 15000);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(30);
  });

  it("validates base32 secrets and rejects obviously invalid ones", () => {
    expect(isValidBase32Secret("JBSWY3DPEHPK3PXP")).toBe(true);
    expect(isValidBase32Secret("not-base32!!!")).toBe(false);
    expect(isValidBase32Secret("short")).toBe(false);
  });
});
