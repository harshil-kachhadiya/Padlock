"use client";

import { useTheme } from "@/lib/themeContext";
import { useSettings } from "@/lib/settingsContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { updateSetting } = useSettings();

  function handleClick() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    updateSetting("theme", next);
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Toggle dark mode"
      className="rounded-sm border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
    >
      {theme === "light" ? "Dark mode" : "Light mode"}
    </button>
  );
}
