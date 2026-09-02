"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { decryptEntry, type EncryptedPayload } from "@/lib/crypto";
import { estimatePasswordStrength, type StrengthLabel } from "@/lib/passwordStrength";
import { useKey } from "@/lib/keyContext";
import { Alert, Button, Card, CardBody, CardHeader, SiteHeader, PageContainer } from "@/components/ui";

const OLD_THRESHOLD_DAYS = 365;

type HealthEntry = {
  siteId: string;
  siteName: string;
  username: string;
  password: string;
  updatedAt: string;
  strength: { score: number; label: StrengthLabel };
  ageDays: number;
};

type SiteRow = {
  id: string;
  site_name: string;
  username: string | null;
  passwords: {
    id: string;
    encrypted_password: EncryptedPayload;
    created_at: string;
    updated_at: string | null;
    deleted: boolean;
  }[];
};

export default function HealthPage() {
  const router = useRouter();
  const { key, clearKey } = useKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<HealthEntry[]>([]);
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
          "id, site_name, username, passwords(id, encrypted_password, created_at, updated_at, deleted)"
        )
        .eq("user_id", user.id)
        .eq("deleted", false);

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const siteRows = (data ?? []) as unknown as SiteRow[];
      const now = Date.now();

      const decrypted = await Promise.all(
        siteRows.map(async (site) => {
          const activePassword = site.passwords
            .filter((p) => !p.deleted)
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
          if (!activePassword) return null;

          const password = await decryptEntry(key!, activePassword.encrypted_password);
          const updatedAt = activePassword.updated_at ?? activePassword.created_at;
          const ageDays = Math.floor((now - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));

          return {
            siteId: site.id,
            siteName: site.site_name,
            username: site.username ?? "",
            password,
            updatedAt,
            strength: estimatePasswordStrength(password),
            ageDays,
          } satisfies HealthEntry;
        })
      );

      setEntries(decrypted.filter((e): e is HealthEntry => e !== null));
      setLoading(false);
    }

    load();
  }, [key, router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
  }

  const weak = entries.filter((e) => e.strength.label === "Weak" || e.strength.label === "Fair");
  const old = entries.filter((e) => e.ageDays >= OLD_THRESHOLD_DAYS);

  const passwordCounts = new Map<string, HealthEntry[]>();
  for (const entry of entries) {
    const list = passwordCounts.get(entry.password) ?? [];
    list.push(entry);
    passwordCounts.set(entry.password, list);
  }
  const reused = [...passwordCounts.values()].filter((group) => group.length > 1).flat();

  const healthyCount = entries.length - new Set([...weak, ...old, ...reused].map((e) => e.siteId)).size;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <PageContainer className="flex flex-1 items-center justify-center">
          <p className="text-sm text-foreground-muted">Analyzing your vault&hellip;</p>
        </PageContainer>
      </div>
    );
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

        <h1 className="font-serif text-2xl font-bold text-foreground">Vault health</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Everything here is computed locally from passwords already decrypted in your browser —
          nothing is sent anywhere.
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {entries.length === 0 ? (
          <Card className="mt-6">
            <div className="px-6 py-10 text-center text-sm text-foreground-muted">
              No entries yet — nothing to analyze.
            </div>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardBody className="text-center">
                  <p className="text-2xl font-bold text-green-700">{healthyCount}</p>
                  <p className="text-xs text-foreground-muted">Healthy</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <p className="text-2xl font-bold text-red-600">{weak.length}</p>
                  <p className="text-xs text-foreground-muted">Weak</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{reused.length}</p>
                  <p className="text-xs text-foreground-muted">Reused</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <p className="text-2xl font-bold text-foreground-muted">{old.length}</p>
                  <p className="text-xs text-foreground-muted">Old (1yr+)</p>
                </CardBody>
              </Card>
            </div>

            <HealthSection
              title="Weak or fair passwords"
              description="Short or low-variety passwords are easier to guess or brute-force."
              entries={weak}
              router={router}
              badge={(e) => e.strength.label}
            />

            <HealthSection
              title="Reused passwords"
              description="The same password protects more than one account — a breach of one exposes the others."
              entries={reused}
              router={router}
              badge={() => "Reused"}
            />

            <HealthSection
              title="Old passwords"
              description={`Unchanged for over a year (${OLD_THRESHOLD_DAYS}+ days). Consider rotating.`}
              entries={old}
              router={router}
              badge={(e) => `${e.ageDays}d old`}
            />
          </>
        )}
      </PageContainer>
    </div>
  );
}

function HealthSection({
  title,
  description,
  entries,
  router,
  badge,
}: {
  title: string;
  description: string;
  entries: HealthEntry[];
  router: ReturnType<typeof useRouter>;
  badge: (entry: HealthEntry) => string;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
          {title}
        </h2>
        <p className="mt-1 text-xs text-foreground-muted">{description}</p>
      </CardHeader>
      <CardBody>
        {entries.length === 0 ? (
          <p className="text-sm text-foreground-muted">Nothing to flag here. Nice work.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.siteId + badge(entry)}
                className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{entry.siteName}</p>
                  <p className="text-xs text-foreground-muted">{entry.username}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-sm bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground-muted">
                    {badge(entry)}
                  </span>
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                    onClick={() => router.push(`/dashboard/edit/${entry.siteId}`)}
                  >
                    Fix
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
