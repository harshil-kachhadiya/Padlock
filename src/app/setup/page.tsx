"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { generateSalt, deriveKey, createVerifier } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { Alert, Button, Card, CardBody, Input, SiteHeader, PageContainer } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const { setKey } = useKey();

  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkExistingSetup() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: existingRow } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .eq("deleted", false)
        .maybeSingle();

      if (existingRow) {
        router.replace("/unlock");
        return;
      }

      setChecking(false);
    }

    checkExistingSetup();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Master password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const salt = generateSalt();
      const derivedKey = await deriveKey(password, salt);
      const verifier = await createVerifier(derivedKey);

      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ salt, verifier }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to set up vault.");
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
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Set your master password
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              This password encrypts your vault. It is never sent to our servers — if you forget
              it, your data cannot be recovered.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <Input
                label="Master password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />

              <Input
                label="Confirm master password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              {error && <Alert variant="error">{error}</Alert>}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Setting up…" : "Create vault"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
