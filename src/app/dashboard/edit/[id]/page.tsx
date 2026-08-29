"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, encryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { Alert, Button, Card, CardBody, Input, SiteHeader, PageContainer } from "@/components/ui";

export default function EditEntryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const siteId = params.id;
  const { key } = useKey();

  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
      return;
    }

    async function loadEntry() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("site_name, site_url, username, passwords(id, encrypted_password, created_at, deleted)")
        .eq("id", siteId)
        .eq("user_id", user.id)
        .eq("deleted", false)
        .single();

      if (siteError || !site) {
        setError("Entry not found.");
        setLoading(false);
        return;
      }

      setSiteName(site.site_name);
      setSiteUrl(site.site_url);
      setUsername(site.username ?? "");

      const activePassword = (
        site.passwords as { id: string; encrypted_password: EncryptedPayload; created_at: string; deleted: boolean }[]
      )
        .filter((p) => !p.deleted)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

      if (activePassword) {
        const plaintext = await decryptEntry(key!, activePassword.encrypted_password);
        setPassword(plaintext);
      }

      setLoading(false);
    }

    loadEntry();
  }, [key, router, siteId]);

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

      const response = await fetch(`/api/entries/${siteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ siteName, siteUrl, username, encryptedPassword }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to update entry.");
        setSubmitting(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loading) {
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
      <PageContainer className="flex flex-1 items-start justify-center">
        <Card className="w-full max-w-md">
          <CardBody>
            <h1 className="font-serif text-2xl font-bold text-foreground">Edit entry</h1>

            <form onSubmit={handleSubmit} className="mt-6">
              <Input
                label="Site name"
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
              />

              <Input
                label="Site URL"
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />

              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving…" : "Save changes"}
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
