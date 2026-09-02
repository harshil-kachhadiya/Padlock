"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { Alert, Button, Card, SiteHeader, PageContainer } from "@/components/ui";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  revealed: boolean;
};

type NoteRow = {
  id: string;
  title: string;
  encrypted_content: EncryptedPayload;
  updated_at: string;
};

export default function NotesPage() {
  const router = useRouter();
  const { key, clearKey } = useKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
      return;
    }
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, router]);

  async function loadNotes() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      router.replace("/login");
      return;
    }

    setUserEmail(user.email ?? null);

    const { data, error: fetchError } = await supabase
      .from("secure_notes")
      .select("id, title, encrypted_content, updated_at")
      .eq("user_id", user.id)
      .eq("deleted", false)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as NoteRow[];

    const decrypted = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        title: row.title,
        content: await decryptEntry(key!, row.encrypted_content),
        updatedAt: row.updated_at,
        revealed: false,
      }))
    );

    setNotes(decrypted);
    setLoading(false);
  }

  function toggleReveal(id: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, revealed: !n.revealed } : n)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note? This cannot be undone from the UI.")) return;

    setDeletingId(id);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      router.replace("/login");
      return;
    }

    const response = await fetch(`/api/notes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete note.");
      setDeletingId(null);
      return;
    }

    setNotes((prev) => prev.filter((n) => n.id !== id));
    setDeletingId(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <PageContainer>
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-4 text-xs font-semibold text-navy-700 hover:underline dark:text-gold-500"
        >
          &larr; Back to vault
        </button>

        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Secure notes</h1>
            <p className="text-sm text-foreground-muted">
              {notes.length} note{notes.length === 1 ? "" : "s"} — for anything that isn&apos;t a
              site login: Wi-Fi passwords, recovery codes, PINs.
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/notes/add")}>+ Add note</Button>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <p className="text-sm text-foreground-muted">Loading notes&hellip;</p>
        ) : notes.length === 0 ? (
          <Card>
            <div className="px-6 py-10 text-center text-sm text-foreground-muted">
              No notes yet. Click &ldquo;Add note&rdquo; to save your first one.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id}>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold text-foreground">{note.title}</h2>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={() => router.push(`/dashboard/notes/edit/${note.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3 py-1 text-xs"
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2">
                    {note.revealed ? (
                      <p className="whitespace-pre-wrap font-mono text-xs text-foreground">
                        {note.content}
                      </p>
                    ) : (
                      <p className="font-mono text-xs text-foreground-muted">
                        {"•".repeat(24)}
                      </p>
                    )}
                    <button
                      onClick={() => toggleReveal(note.id)}
                      className="mt-1 text-xs font-semibold text-navy-800 underline decoration-dotted underline-offset-2 dark:text-gold-500"
                    >
                      {note.revealed ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
