"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { useSettings } from "@/lib/settingsContext";
import { Alert, Button, Card, SiteHeader, PageContainer, TotpCode } from "@/components/ui";

type Entry = {
  siteId: string;
  siteName: string;
  siteUrl: string;
  username: string | null;
  passwordId: string;
  decryptedPassword: string;
  totpSecret: string | null;
  revealed: boolean;
};

type SiteRow = {
  id: string;
  site_name: string;
  site_url: string;
  username: string | null;
  encrypted_totp_secret: EncryptedPayload | null;
  passwords: {
    id: string;
    encrypted_password: EncryptedPayload;
    created_at: string;
    updated_at: string | null;
    deleted: boolean;
  }[];
};

const EXPIRY_REMINDER_DAYS = 365;
const EXPIRY_DISMISS_KEY = "padlock-expiry-reminder-dismissed";

export default function DashboardPage() {
  const router = useRouter();
  const { key, clearKey } = useKey();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [oldPasswordCount, setOldPasswordCount] = useState(0);
  const [expiryDismissed, setExpiryDismissed] = useState(false);

  useEffect(() => {
    setExpiryDismissed(window.sessionStorage.getItem(EXPIRY_DISMISS_KEY) === "1");
  }, []);

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
      .select(
        "id, site_name, site_url, username, encrypted_totp_secret, passwords(id, encrypted_password, created_at, updated_at, deleted)"
      )
      .eq("user_id", user.id)
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as SiteRow[];
    const now = Date.now();

    const oldCount = rows.filter((row) => {
      const activePassword = row.passwords
        .filter((p) => !p.deleted)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (!activePassword) return false;
      const updatedAt = activePassword.updated_at ?? activePassword.created_at;
      const ageDays = (now - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays >= EXPIRY_REMINDER_DAYS;
    }).length;
    setOldPasswordCount(oldCount);

    const decrypted = await Promise.all(
      rows.map(async (row) => {
        const activePassword = row.passwords
          .filter((p) => !p.deleted)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

        if (!activePassword) return null;

        const plaintext = await decryptEntry(key!, activePassword.encrypted_password);
        const totpSecret = row.encrypted_totp_secret
          ? await decryptEntry(key!, row.encrypted_totp_secret)
          : null;

        return {
          siteId: row.id,
          siteName: row.site_name,
          siteUrl: row.site_url,
          username: row.username,
          passwordId: activePassword.id,
          decryptedPassword: plaintext,
          totpSecret,
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

  function dismissExpiryReminder() {
    window.sessionStorage.setItem(EXPIRY_DISMISS_KEY, "1");
    setExpiryDismissed(true);
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredEntries = searchTerm
    ? entries.filter(
        (e) =>
          e.siteName.toLowerCase().includes(searchTerm) ||
          e.siteUrl.toLowerCase().includes(searchTerm) ||
          (e.username ?? "").toLowerCase().includes(searchTerm)
      )
    : entries;

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
            <Button variant="secondary" onClick={() => router.push("/dashboard/notes")}>
              Notes
            </Button>
            <Button variant="secondary" onClick={() => router.push("/dashboard/health")}>
              Vault health
            </Button>
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

        {!loading && oldPasswordCount > 0 && !expiryDismissed && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border-l-4 border-navy-700 bg-navy-700/5 px-4 py-3 text-sm">
            <span className="text-foreground">
              {oldPasswordCount} password{oldPasswordCount === 1 ? " hasn't" : "s haven't"} been
              changed in over a year. Consider rotating{" "}
              {oldPasswordCount === 1 ? "it" : "them"}.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/dashboard/health")}
                className="text-xs font-semibold text-navy-800 underline dark:text-gold-500"
              >
                Review
              </button>
              <button
                onClick={dismissExpiryReminder}
                className="text-xs font-semibold text-foreground-muted hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by site, URL, or username&hellip;"
            aria-label="Search your vault"
            className="mb-4 w-full max-w-sm rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-navy-700 focus:ring-2 focus:ring-navy-700/30"
          />
        )}

        {loading ? (
          <p className="text-sm text-foreground-muted">Loading vault&hellip;</p>
        ) : entries.length === 0 ? (
          <Card>
            <div className="px-6 py-10 text-center text-sm text-foreground-muted">
              No entries yet. Click &ldquo;Add entry&rdquo; to save your first credential.
            </div>
          </Card>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <div className="px-6 py-10 text-center text-sm text-foreground-muted">
              No entries match &ldquo;{search}&rdquo;.
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
                    <th className="px-4 py-3 font-semibold">2FA</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
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
                        {entry.totpSecret ? (
                          <TotpCode secret={entry.totpSecret} />
                        ) : (
                          <span className="text-xs text-foreground-muted">—</span>
                        )}
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
