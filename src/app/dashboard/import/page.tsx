"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { encryptEntry } from "@/lib/crypto";
import { useKey } from "@/lib/keyContext";
import { parseCsv } from "@/lib/csv";
import { Alert, Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

type ParsedRow = {
  siteName: string;
  siteUrl: string;
  username: string;
  password: string;
};

type ImportResult = {
  succeeded: number;
  failed: { row: ParsedRow; error: string }[];
};

function parseCsvFile(text: string): { rows: ParsedRow[]; error: string | null } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: "The file is empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("site_name");
  const urlIdx = header.indexOf("site_url");
  const userIdx = header.indexOf("username");
  const passIdx = header.indexOf("password");

  if (nameIdx === -1 || urlIdx === -1 || passIdx === -1) {
    return {
      rows: [],
      error:
        'Missing required columns. Expected a header row with "site_name, site_url, username, password".',
    };
  }

  const rows: ParsedRow[] = table.slice(1).map((cols) => ({
    siteName: cols[nameIdx]?.trim() ?? "",
    siteUrl: cols[urlIdx]?.trim() ?? "",
    username: userIdx !== -1 ? cols[userIdx]?.trim() ?? "" : "",
    password: cols[passIdx]?.trim() ?? "",
  }));

  return { rows: rows.filter((r) => r.siteName && r.siteUrl && r.password), error: null };
}

function parseJsonFile(text: string): { rows: ParsedRow[]; error: string | null } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], error: "That file isn't valid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { rows: [], error: "Expected a JSON array of entries." };
  }

  const rows: ParsedRow[] = parsed.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (typeof record[k] === "string") return (record[k] as string).trim();
      }
      return "";
    };

    return {
      siteName: get("site_name", "siteName", "name"),
      siteUrl: get("site_url", "siteUrl", "url"),
      username: get("username", "user"),
      password: get("password", "pass"),
    };
  });

  return { rows: rows.filter((r) => r.siteName && r.siteUrl && r.password), error: null };
}

function parseFile(
  text: string,
  filename: string
): { rows: ParsedRow[]; error: string | null } {
  const looksLikeJson = filename.toLowerCase().endsWith(".json") || text.trim().startsWith("[");
  return looksLikeJson ? parseJsonFile(text) : parseCsvFile(text);
}

export default function ImportPage() {
  const router = useRouter();
  const { key, clearKey } = useKey();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!key) {
      router.replace("/unlock");
      return;
    }
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [key, router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setParseError(null);

    const text = await file.text();
    const { rows: parsed, error } = parseFile(text, file.name);

    if (error) {
      setParseError(error);
      setRows([]);
      return;
    }

    setRows(parsed);
  }

  async function handleImport() {
    if (!key || rows.length === 0) return;

    setImporting(true);
    setProgress(0);
    const failed: ImportResult["failed"] = [];

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      router.replace("/login");
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const encryptedPassword = await encryptEntry(key, row.password);

        const response = await fetch("/api/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            siteName: row.siteName,
            siteUrl: row.siteUrl,
            username: row.username,
            encryptedPassword,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          failed.push({ row, error: body.error ?? "Failed to save." });
        }
      } catch (err) {
        failed.push({ row, error: err instanceof Error ? err.message : "Unknown error." });
      }

      setProgress(i + 1);
    }

    setResult({ succeeded: rows.length - failed.length, failed });
    setImporting(false);
    setRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <PageContainer className="max-w-2xl">
        <div className="mb-4 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-navy-700 hover:underline dark:text-gold-500"
          >
            &larr; Back to vault
          </button>
          <button
            onClick={() => router.push("/dashboard/export")}
            className="text-navy-700 hover:underline dark:text-gold-500"
          >
            Export instead
          </button>
        </div>

        <h1 className="font-serif text-2xl font-bold text-foreground">Import entries</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Upload a CSV or JSON file exported from Padlock — a CSV needs a header row of{" "}
          <code className="font-mono">site_name</code>, <code className="font-mono">site_url</code>
          , <code className="font-mono">username</code>, <code className="font-mono">password</code>
          ; a JSON file needs an array of objects with those same keys. Each password is encrypted
          in your browser before it&apos;s uploaded.
        </p>

        <Card className="mt-6">
          <CardBody>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="block w-full text-sm text-foreground file:mr-4 file:rounded-sm file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
            />

            {parseError && (
              <Alert variant="error">
                <div className="mt-2">{parseError}</div>
              </Alert>
            )}

            {rows.length > 0 && !importing && (
              <>
                <Alert variant="info">
                  <div className="mt-2">
                    Found {rows.length} valid row{rows.length === 1 ? "" : "s"} ready to import.
                  </div>
                </Alert>
                <Button onClick={handleImport}>Import {rows.length} entries</Button>
              </>
            )}

            {importing && (
              <p className="mb-4 text-sm font-semibold text-navy-700 dark:text-gold-500">
                Importing {progress} / {rows.length}&hellip;
              </p>
            )}

            {result && (
              <div className="mt-2">
                <Alert variant={result.failed.length === 0 ? "success" : "error"}>
                  <div className="mt-2">
                    Imported {result.succeeded} entr{result.succeeded === 1 ? "y" : "ies"}.
                    {result.failed.length > 0 && ` ${result.failed.length} failed.`}
                  </div>
                </Alert>
                {result.failed.length > 0 && (
                  <ul className="mb-4 list-disc pl-5 text-xs text-foreground-muted">
                    {result.failed.map((f, i) => (
                      <li key={i}>
                        {f.row.siteName}: {f.error}
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="secondary" onClick={() => router.push("/dashboard")}>
                  Go to vault
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
