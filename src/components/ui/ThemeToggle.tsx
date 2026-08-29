"use client";

import { useTheme } from "@/lib/themeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="rounded-sm border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
    >
      {theme === "light" ? "Dark mode" : "Light mode"}
    </button>
  );
}
