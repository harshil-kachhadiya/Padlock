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

  const isLight = theme === "light";

  return (
    <button
      onClick={handleClick}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="flex items-center gap-1.5 rounded-sm border border-white/20 p-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:px-3 sm:py-1.5"
    >
      {/* Icon-only on small screens — the full label crowded out the menu
          button in the mobile header. */}
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isLight ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
      <span className="hidden sm:inline">{isLight ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
