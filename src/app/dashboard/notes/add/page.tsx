"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { encryptEntry } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { Alert, Button, Card, CardBody, Input, SiteHeader, PageContainer } from "@/components/ui";

export default function AddNotePage() {
  const router = useRouter();
  const { key } = useKey();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!key) router.replace("/unlock");
  }, [key, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!key) {
      router.replace("/unlock");
      return;
    }

    if (!title || !content) {
      setError("Title and content are required.");
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

      const encryptedContent = await encryptEntry(key, content);

      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, encryptedContent }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to save note.");
        setSubmitting(false);
        return;
      }

      router.replace("/dashboard/notes");
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
            <h1 className="font-serif text-2xl font-bold text-foreground">Add note</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Encrypted in your browser before it&apos;s sent anywhere — same as passwords.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <Input
                label="Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Home Wi-Fi"
              />

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-navy-700 focus:ring-2 focus:ring-navy-700/30"
                  placeholder="Network: HomeNet-5G&#10;Password: ..."
                />
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving…" : "Save note"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/dashboard/notes")}
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
