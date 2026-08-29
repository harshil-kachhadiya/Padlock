"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { deriveKey, checkVerifier, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
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
        .select("salt, verifier")
        .eq("id", user.id)
        .eq("deleted", false)
        .maybeSingle();

      if (fetchError || !row) {
        router.replace("/setup");
        return;
      }

      setSalt(row.salt as number[]);
      setVerifier(row.verifier as EncryptedPayload);
      setChecking(false);
    }

    loadVault();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!salt || !verifier) return;

    setSubmitting(true);

    try {
      const derivedKey = await deriveKey(password, salt);
      const isValid = await checkVerifier(derivedKey, verifier);

      if (!isValid) {
        setError("Incorrect master password.");
        setSubmitting(false);
        return;
      }

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
              />

              {error && <Alert variant="error">{error}</Alert>}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Unlocking…" : "Unlock"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
