"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, encryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { Alert, Button, Card, CardBody, Input, SiteHeader, PageContainer } from "@/components/ui";

export default function EditNotePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { key } = useKey();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
      return;
    }

    async function loadNote() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: note, error: noteError } = await supabase
        .from("secure_notes")
        .select("title, encrypted_content")
        .eq("id", noteId)
        .eq("user_id", user.id)
        .eq("deleted", false)
        .single();

      if (noteError || !note) {
        setError("Note not found.");
        setLoading(false);
        return;
      }

      setTitle(note.title);
      setContent(await decryptEntry(key!, note.encrypted_content as EncryptedPayload));
      setLoading(false);
    }

    loadNote();
  }, [key, router, noteId]);

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

      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, encryptedContent }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to update note.");
        setSubmitting(false);
        return;
      }

      router.replace("/dashboard/notes");
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
            <h1 className="font-serif text-2xl font-bold text-foreground">Edit note</h1>

            <form onSubmit={handleSubmit} className="mt-6">
              <Input
                label="Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                />
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving…" : "Save changes"}
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
