import { describe, it, expect } from "vitest";
import { estimatePasswordStrength } from "../passwordStrength";

describe("estimatePasswordStrength", () => {
  it("rates an empty password as weak", () => {
    expect(estimatePasswordStrength("").label).toBe("Weak");
  });

  it("rates a short password as weak regardless of variety", () => {
    expect(estimatePasswordStrength("Ab1!").label).toBe("Weak");
  });

  it("rates a long, single-case, letters-only password below strong", () => {
    const { label } = estimatePasswordStrength("abcdefghijklmnopqrstuvwxyz");
    expect(["Weak", "Fair", "Good"]).toContain(label);
  });

  it("rates a long password with full character variety as strong", () => {
    const { label } = estimatePasswordStrength("Tr0ub4dor&3-VeryLongPassphrase!");
    expect(label).toBe("Strong");
  });

  it("increasing length with the same variety never decreases the score", () => {
    const shorter = estimatePasswordStrength("Abcdef1!").score;
    const longer = estimatePasswordStrength("Abcdef1!Abcdef1!").score;
    expect(longer).toBeGreaterThanOrEqual(shorter);
  });
});
