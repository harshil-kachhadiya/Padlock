"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000;
const AUTO_LOCK_STORAGE_KEY = "padlock-autolock-ms";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

type KeyContextValue = {
  key: CryptoKey | null;
  setKey: (key: CryptoKey) => void;
  clearKey: () => void;
  autoLockMs: number;
  setAutoLockMs: (ms: number) => void;
};

const KeyContext = createContext<KeyContextValue | undefined>(undefined);

export function KeyProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<CryptoKey | null>(null);
  const [autoLockMs, setAutoLockMsState] = useState(DEFAULT_AUTO_LOCK_MS);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      setAutoLockMsState(parsed);
    }
  }, []);

  function setKey(newKey: CryptoKey) {
    setKeyState(newKey);
  }

  function clearKey() {
    setKeyState(null);
  }

  function setAutoLockMs(ms: number) {
    setAutoLockMsState(ms);
    window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(ms));
  }

  useEffect(() => {
    if (!key) return;

    function resetTimer() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setKeyState(null);
      }, autoLockMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [key, autoLockMs]);

  return (
    <KeyContext.Provider value={{ key, setKey, clearKey, autoLockMs, setAutoLockMs }}>
      {children}
    </KeyContext.Provider>
  );
}

export function useKey() {
  const ctx = useContext(KeyContext);
  if (!ctx) {
    throw new Error("useKey must be used within a KeyProvider");
  }
  return ctx;
}
