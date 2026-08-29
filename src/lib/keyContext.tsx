"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

const AUTO_LOCK_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

type KeyContextValue = {
  key: CryptoKey | null;
  setKey: (key: CryptoKey) => void;
  clearKey: () => void;
};

const KeyContext = createContext<KeyContextValue | undefined>(undefined);

export function KeyProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<CryptoKey | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setKey(newKey: CryptoKey) {
    setKeyState(newKey);
  }

  function clearKey() {
    setKeyState(null);
  }

  useEffect(() => {
    if (!key) return;

    function resetTimer() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setKeyState(null);
      }, AUTO_LOCK_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [key]);

  return (
    <KeyContext.Provider value={{ key, setKey, clearKey }}>
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
