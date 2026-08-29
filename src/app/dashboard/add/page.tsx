"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { encryptEntry } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  PasswordInput,
  SiteHeader,
  PageContainer,
} from "@/components/ui";

export default function AddEntryPage() {
  const router = useRouter();
  const { key } = useKey();

  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
    }
  }, [key, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!key) {
      router.replace("/unlock");
      return;
    }

    if (!siteName || !siteUrl || !password) {
      setError("Site name, site URL, and password are required.");
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

      const encryptedPassword = await encryptEntry(key, password);

      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ siteName, siteUrl, username, encryptedPassword }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to save entry.");
        setSubmitting(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="flex flex-1 items-start justify-center">
        <Card className="w-full max-w-md">
          <CardBody>
            <h1 className="font-serif text-2xl font-bold text-foreground">Add entry</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              The password is encrypted in your browser before it is sent anywhere.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <Input
                label="Site name"
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Gmail"
              />

              <Input
                label="Site URL"
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="gmail.com"
              />

              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving…" : "Save entry"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
