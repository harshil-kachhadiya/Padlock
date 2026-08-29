"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { buildCsv } from "@/lib/csv";
import { Alert, Button, Card, SiteHeader, PageContainer } from "@/components/ui";

type Row = {
  siteName: string;
  siteUrl: string;
  username: string;
  password: string;
  createdAt: string;
};

type SiteRow = {
  id: string;
  site_name: string;
  site_url: string;
  username: string | null;
  created_at: string;
  passwords: { id: string; encrypted_password: EncryptedPayload; created_at: string; deleted: boolean }[];
};

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const router = useRouter();
  const { key, clearKey } = useKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
      return;
    }

    async function load() {
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
          "id, site_name, site_url, username, created_at, passwords(id, encrypted_password, created_at, deleted)"
        )
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const siteRows = (data ?? []) as unknown as SiteRow[];

      const decrypted = await Promise.all(
        siteRows.map(async (site) => {
          const activePassword = site.passwords
            .filter((p) => !p.deleted)
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
          if (!activePassword) return null;

          const password = await decryptEntry(key!, activePassword.encrypted_password);

          return {
            siteName: site.site_name,
            siteUrl: site.site_url,
            username: site.username ?? "",
            password,
            createdAt: site.created_at,
          } satisfies Row;
        })
      );

      setRows(decrypted.filter((r): r is Row => r !== null));
      setLoading(false);
    }

    load();
  }, [key, router]);

  function handleExportCsv() {
    const header = ["site_name", "site_url", "username", "password"];
    const body = rows.map((r) => [r.siteName, r.siteUrl, r.username, r.password]);
    downloadFile("padlock-export.csv", buildCsv([header, ...body]), "text/csv;charset=utf-8");
  }

  function handleExportJson() {
    const payload = rows.map((r) => ({
      site_name: r.siteName,
      site_url: r.siteUrl,
      username: r.username,
      password: r.password,
    }));
    downloadFile(
      "padlock-export.json",
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader userEmail={userEmail} onSignOut={handleSignOut} />
        <PageContainer className="flex flex-1 items-center justify-center">
          <p className="text-sm text-foreground-muted">Decrypting your vault&hellip;</p>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={userEmail} onSignOut={handleSignOut} />
      <PageContainer>
        <div className="mb-4 flex gap-4 text-xs font-semibold">
          <button onClick={() => router.push("/dashboard")} className="text-navy-700 hover:underline dark:text-gold-500">
            &larr; Back to vault
          </button>
          <button onClick={() => router.push("/dashboard/import")} className="text-navy-700 hover:underline dark:text-gold-500">
            Import instead
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Export vault</h1>
            <p className="text-sm text-foreground-muted">
              Everything below is decrypted in your browser only — nothing here is sent anywhere
              until you choose to download it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRevealed((v) => !v)}>
              {revealed ? "Hide passwords" : "Show passwords"}
            </Button>
            <Button onClick={handleExportCsv}>Download CSV</Button>
            <Button variant="secondary" onClick={handleExportJson}>
              Download JSON
            </Button>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <Alert variant="info">
          Exported files contain your passwords in plain text. Store them somewhere safe and
          delete them once you no longer need them.
        </Alert>

        {rows.length === 0 ? (
          <Card>
            <div className="px-6 py-10 text-center text-sm text-foreground-muted">
              No entries to export yet.
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <th className="px-4 py-3 font-semibold">Site</th>
                    <th className="px-4 py-3 font-semibold">URL</th>
                    <th className="px-4 py-3 font-semibold">Username</th>
                    <th className="px-4 py-3 font-semibold">Password</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold text-foreground">{row.siteName}</td>
                      <td className="px-4 py-3 text-foreground-muted">{row.siteUrl}</td>
                      <td className="px-4 py-3 text-foreground">{row.username}</td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {revealed ? row.password : "•".repeat(10)}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted">
                        {new Date(row.createdAt).toLocaleDateString()}
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
