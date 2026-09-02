"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Alert, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      router.replace("/");
    }

    /**
     * Under PKCE the client exchanges the ?code= for a session during
     * initialization, so the session may not exist yet on first paint. Listen
     * for the sign-in event and also check directly, whichever lands first.
     */
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (data.session) {
        finish();
        return;
      }
      if (sessionError) {
        setError(sessionError.message);
        done = true;
      }
    });

    // If neither path produced a session, surface a real error rather than
    // spinning on "Signing you in…" forever.
    const timeout = setTimeout(() => {
      if (!done) {
        setError("Sign-in did not complete. Please try again.");
        done = true;
      }
    }, 10000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardBody className="text-center">
            {error ? (
              <>
                <Alert variant="error">Sign-in failed: {error}</Alert>
                <button
                  onClick={() => router.replace("/login")}
                  className="mt-3 text-xs font-semibold text-navy-700 hover:underline dark:text-gold-500"
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <p className="text-sm text-foreground-muted">Signing you in&hellip;</p>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
