export type StrengthLabel = "Weak" | "Fair" | "Good" | "Strong";

export function estimatePasswordStrength(password: string): {
  score: number;
  label: StrengthLabel;
} {
  if (!password) return { score: 0, label: "Weak" };
  if (password.length < 8) return { score: 0.15, label: "Weak" };

  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/[0-9]/.test(password)) variety++;
  if (/[^a-zA-Z0-9]/.test(password)) variety++;

  const lengthScore = Math.min(password.length / 20, 1);
  const varietyScore = variety / 4;
  const score = lengthScore * 0.6 + varietyScore * 0.4;

  if (score < 0.45) return { score, label: "Weak" };
  if (score < 0.7) return { score, label: "Fair" };
  if (score < 0.85) return { score, label: "Good" };
  return { score, label: "Strong" };
}
