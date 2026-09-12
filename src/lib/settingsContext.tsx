"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { useTheme } from "./themeContext";
import { useKey } from "./keyContext";

export type Settings = {
  theme: "light" | "dark" | "system";
  auto_lock_ms: number;
  reveal_password_default: boolean;
  expand_all_items_default: boolean;
  never_show_passwords: boolean;
  hint_only_mode: boolean;
  auto_fill_single_match: boolean;
  lock_chrome_by_default: boolean;
  show_all_items: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  auto_lock_ms: 5 * 60 * 1000,
  reveal_password_default: false,
  expand_all_items_default: false,
  never_show_passwords: false,
  hint_only_mode: false,
  auto_fill_single_match: false,
  lock_chrome_by_default: false,
  show_all_items: false,
};

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  // Resolves false (rather than throwing) on failure — the setting was
  // already rolled back in state by then, so callers just need to know
  // whether to tell the user it didn't save.
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<boolean>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (!cancelled) setLoaded(true);
        return;
      }

      try {
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const body = await res.json();
          if (!cancelled) {
            setSettings((prev) => ({ ...prev, ...body.settings }));
          }
        }
      } catch {
        // Network hiccup — fall back to defaults, still usable.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const previous = settings[key];
    setSettings((prev) => ({ ...prev, [key]: value }));

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return false;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) {
        // A silent failure here previously meant the UI could show a
        // setting as "on" while the row was never written — most commonly
        // because setting_key has a foreign key against setting_items, and
        // a not-yet-applied migration means that row doesn't exist yet.
        // Roll back so the UI reflects what's actually saved.
        setSettings((prev) => ({ ...prev, [key]: previous }));
        return false;
      }

      return true;
    } catch {
      setSettings((prev) => ({ ...prev, [key]: previous }));
      return false;
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

// Applies remote settings (theme, auto-lock) into the other contexts once,
// right after they finish loading — a one-time sync on app boot, not a
// continuous binding (each context stays the source of truth afterward).
export function SettingsSync({ children }: { children: ReactNode }) {
  const { settings, loaded } = useSettings();
  const { theme, setTheme } = useTheme();
  const { setAutoLockMs } = useKey();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!loaded || appliedRef.current) return;
    appliedRef.current = true;

    if (settings.theme !== theme) setTheme(settings.theme);
    setAutoLockMs(settings.auto_lock_ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return <>{children}</>;
}
