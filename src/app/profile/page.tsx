"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { Button, Card, CardBody, CardHeader, SiteHeader, PageContainer } from "@/components/ui";

type VaultRow = {
  oauth_provider: string;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { key, clearKey } = useKey();

  const [user, setUser] = useState<User | null>(null);
  const [vaultRow, setVaultRow] = useState<VaultRow | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;

      if (!authUser) {
        router.replace("/login");
        return;
      }

      setUser(authUser);

      const { data: row } = await supabase
        .from("users")
        .select("oauth_provider, created_at")
        .eq("id", authUser.id)
        .eq("deleted", false)
        .maybeSingle();

      setVaultRow(row);

      const { count } = await supabase
        .from("sites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authUser.id)
        .eq("deleted", false);

      setEntryCount(count ?? 0);
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    router.replace("/login");
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

      <PageContainer className="max-w-2xl">
        <h1 className="font-serif text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Your account details and vault summary.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Account
            </h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-foreground-muted">Email</dt>
                <dd className="mt-1 text-sm text-foreground">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-foreground-muted">
                  Signed in with
                </dt>
                <dd className="mt-1 text-sm capitalize text-foreground">
                  {vaultRow?.oauth_provider ?? "Google"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-foreground-muted">
                  Vault created
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {vaultRow?.created_at
                    ? new Date(vaultRow.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-foreground-muted">
                  Saved entries
                </dt>
                <dd className="mt-1 text-sm text-foreground">{entryCount ?? "—"}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground-muted">
              Vault status
            </h2>
          </CardHeader>
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-foreground-muted">
              Encryption key:{" "}
              <span className={key ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                {key ? "unlocked (in memory)" : "locked"}
              </span>
            </p>
            {key ? (
              <Button variant="secondary" onClick={() => router.push("/dashboard")}>
                Go to vault
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => router.push("/unlock")}>
                Unlock vault
              </Button>
            )}
          </CardBody>
        </Card>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => router.push("/settings")}>
            Go to settings
          </Button>
          <Button variant="danger" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
