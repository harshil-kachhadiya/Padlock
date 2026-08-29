"use client";

import { useEffect, useState } from "react";
import { generateTotp, secondsRemainingInPeriod } from "@/lib/totp";

export function TotpCode({ secret }: { secret: string }) {
  const [code, setCode] = useState("------");
  const [secondsLeft, setSecondsLeft] = useState(secondsRemainingInPeriod());

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const remaining = secondsRemainingInPeriod();
      if (!cancelled) setSecondsLeft(remaining);

      const next = await generateTotp(secret);
      if (!cancelled) setCode(next);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [secret]);

  function handleCopy() {
    navigator.clipboard.writeText(code).catch(() => {});
  }

  return (
    <button
      onClick={handleCopy}
      title="Click to copy"
      className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-muted px-2 py-1 font-mono text-xs text-foreground hover:border-navy-700"
    >
      <span className="tracking-widest">{code}</span>
      <span className="text-[10px] text-foreground-muted">{secondsLeft}s</span>
    </button>
  );
}
