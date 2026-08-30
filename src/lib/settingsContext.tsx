"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { useTheme } from "./themeContext";
import { useKey } from "./keyContext";

export type Settings = {
  theme: "light" | "dark";
  auto_lock_ms: number;
  reveal_password_default: boolean;
  expand_all_items_default: boolean;
  never_show_passwords: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  auto_lock_ms: 5 * 60 * 1000,
  reveal_password_default: false,
  expand_all_items_default: false,
  never_show_passwords: false,
};

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
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
    setSettings((prev) => ({ ...prev, [key]: value }));

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return;

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ key, value }),
      });
    } catch {
      // Best-effort persistence — the in-memory value is already applied.
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
