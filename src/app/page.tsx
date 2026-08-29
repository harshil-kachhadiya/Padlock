"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const { key, clearKey } = useKey();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    setUser(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={user?.email} onSignOut={user ? handleSignOut : undefined} />

      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            {loading ? (
              <p className="text-sm text-foreground-muted">Loading&hellip;</p>
            ) : user ? (
              <>
                <h1 className="font-serif text-2xl font-bold text-foreground">Welcome back</h1>
                <p className="mt-2 text-sm text-foreground-muted">Signed in as {user.email}</p>
                <p className="mt-1 text-sm text-foreground-muted">
                  Vault status:{" "}
                  <span
                    className={
                      key
                        ? "font-semibold text-green-700"
                        : "font-semibold text-red-600"
                    }
                  >
                    {key ? "Unlocked" : "Locked"}
                  </span>
                </p>
                <div className="mt-6">
                  {key ? (
                    <Button onClick={() => router.push("/dashboard")}>Go to vault</Button>
                  ) : (
                    <Button onClick={() => router.push("/unlock")}>
                      Set up / unlock vault
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  Welcome to Padlock
                </h1>
                <p className="mt-2 text-sm text-foreground-muted">
                  A zero-knowledge encrypted password manager. Sign in to continue.
                </p>
                <div className="mt-6">
                  <Button onClick={() => router.push("/login")}>Go to sign-in</Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
