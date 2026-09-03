"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { deriveKey, checkVerifier, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import {
  loadLockoutState,
  recordFailedAttempt,
  recordSuccess,
  attemptsRemaining,
  isLockedOut,
  secondsUntilUnlocked,
} from "@/lib/unlockLockout";
import {
  Alert,
  Button,
  Card,
  CardBody,
  PasswordInput,
  SiteHeader,
  PageContainer,
} from "@/components/ui";

export default function UnlockPage() {
  const router = useRouter();
  const { setKey } = useKey();

  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [salt, setSalt] = useState<number[] | null>(null);
  const [verifier, setVerifier] = useState<EncryptedPayload | null>(null);
  const [iterations, setIterations] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState(0);

  useEffect(() => {
    async function loadVault() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: row, error: fetchError } = await supabase
        .from("users")
        .select("salt, verifier, pbkdf2_iterations")
        .eq("id", user.id)
        .eq("deleted", false)
        .maybeSingle();

      if (fetchError || !row) {
        router.replace("/setup");
        return;
      }

      setUserId(user.id);
      setSalt(row.salt as number[]);
      setVerifier(row.verifier as EncryptedPayload);
      // Falls back to the legacy default for any row from before this column
      // existed — see supabase/migrations/0010_pbkdf2_iterations.sql.
      setIterations((row.pbkdf2_iterations as number | null) ?? 250_000);

      const lockout = loadLockoutState(user.id);
      if (isLockedOut(lockout)) {
        setLockedSeconds(secondsUntilUnlocked(lockout));
      }

      setChecking(false);
    }

    loadVault();
  }, [router]);

  useEffect(() => {
    if (lockedSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockedSeconds((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedSeconds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!salt || !verifier || !userId || !iterations || lockedSeconds > 0) return;

    setSubmitting(true);

    try {
      const derivedKey = await deriveKey(password, salt, iterations);
      const isValid = await checkVerifier(derivedKey, verifier);

      if (!isValid) {
        const state = recordFailedAttempt(userId);

        if (isLockedOut(state)) {
          setLockedSeconds(secondsUntilUnlocked(state));
          setError(
            `Too many incorrect attempts. Try again in ${secondsUntilUnlocked(state)}s.`
          );
        } else {
          const remaining = attemptsRemaining(state);
          setError(
            `Incorrect master password. ${remaining} attempt${remaining === 1 ? "" : "s"} left before a temporary lockout.`
          );
        }

        setSubmitting(false);
        return;
      }

      recordSuccess(userId);
      setKey(derivedKey);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <PageContainer className="flex flex-1 items-center justify-center">
          <p className="text-sm text-foreground-muted">Loading&hellip;</p>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardBody>
            <h1 className="font-serif text-2xl font-bold text-foreground">Unlock your vault</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Enter your master password to decrypt your vault. It is verified locally and never
              sent to our servers.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <PasswordInput
                label="Master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={lockedSeconds > 0}
              />

              {error && <Alert variant="error">{error}</Alert>}

              <Button
                type="submit"
                disabled={submitting || lockedSeconds > 0}
                className="w-full"
              >
                {lockedSeconds > 0
                  ? `Locked — try again in ${lockedSeconds}s`
                  : submitting
                    ? "Unlocking…"
                    : "Unlock"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
