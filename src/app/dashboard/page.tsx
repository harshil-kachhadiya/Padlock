"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { useSettings } from "@/lib/settingsContext";
import { Alert, Button, Card, SiteHeader, PageContainer } from "@/components/ui";

type Entry = {
  siteId: string;
  siteName: string;
  siteUrl: string;
  username: string | null;
  passwordId: string;
  decryptedPassword: string;
  revealed: boolean;
};

type SiteRow = {
  id: string;
  site_name: string;
  site_url: string;
  username: string | null;
  passwords: { id: string; encrypted_password: EncryptedPayload; created_at: string; deleted: boolean }[];
};

export default function DashboardPage() {
  const router = useRouter();
  const { key, clearKey } = useKey();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
      return;
    }

    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, router]);

  async function loadEntries() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserEmail(user.email ?? null);

    const { data, error: fetchError } = await supabase
      .from("sites")
      .select("id, site_name, site_url, username, passwords(id, encrypted_password, created_at, deleted)")
      .eq("user_id", user.id)
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as SiteRow[];

    const decrypted = await Promise.all(
      rows.map(async (row) => {
        const activePassword = row.passwords
          .filter((p) => !p.deleted)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

        if (!activePassword) return null;

        const plaintext = await decryptEntry(key!, activePassword.encrypted_password);

        return {
          siteId: row.id,
          siteName: row.site_name,
          siteUrl: row.site_url,
          username: row.username,
          passwordId: activePassword.id,
          decryptedPassword: plaintext,
          revealed: settings.reveal_password_default,
        } satisfies Entry;
      })
    );

    setEntries(decrypted.filter((e): e is Entry => e !== null));
    setLoading(false);
  }

  function toggleReveal(siteId: string) {
    setEntries((prev) =>
      prev.map((e) => (e.siteId === siteId ? { ...e, revealed: !e.revealed } : e))
    );
  }

  async function handleDelete(siteId: string) {
    if (!confirm("Delete this entry? This cannot be undone from the UI.")) return;

    setDeletingId(siteId);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      router.replace("/login");
      return;
    }

    const response = await fetch(`/api/entries/${siteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete entry.");
      setDeletingId(null);
      return;
    }

    setEntries((prev) => prev.filter((e) => e.siteId !== siteId));
    setDeletingId(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={userEmail} onSignOut={handleSignOut} />

      <PageContainer>
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Your vault</h1>
            <p className="text-sm text-foreground-muted">
              {entries.length} saved credential{entries.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/dashboard/export")}>
              Export
            </Button>
            <Button variant="secondary" onClick={() => router.push("/dashboard/import")}>
              Import
            </Button>
            <Button onClick={() => router.push("/dashboard/add")}>+ Add entry</Button>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <p className="text-sm text-foreground-muted">Loading vault&hellip;</p>
        ) : entries.length === 0 ? (
          <Card>
            <div className="px-6 py-10 text-center text-sm text-foreground-muted">
              No entries yet. Click &ldquo;Add entry&rdquo; to save your first credential.
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <th className="px-4 py-3 font-semibold">Site</th>
                    <th className="px-4 py-3 font-semibold">Username</th>
                    <th className="px-4 py-3 font-semibold">Password</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.siteId} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-foreground">{entry.siteName}</div>
                        <div className="text-xs text-foreground-muted">{entry.siteUrl}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-foreground">{entry.username}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground">
                            {entry.revealed ? entry.decryptedPassword : "•".repeat(10)}
                          </span>
                          <button
                            onClick={() => toggleReveal(entry.siteId)}
                            className="text-xs font-semibold text-navy-800 underline decoration-dotted underline-offset-2 dark:text-gold-500"
                          >
                            {entry.revealed ? "Hide" : "Show"}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            className="px-3 py-1 text-xs"
                            onClick={() => router.push(`/dashboard/edit/${entry.siteId}`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            className="px-3 py-1 text-xs"
                            onClick={() => handleDelete(entry.siteId)}
                            disabled={deletingId === entry.siteId}
                          >
                            {deletingId === entry.siteId ? "Deleting…" : "Delete"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageContainer>
    </div>
  );
}
