"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Alert, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setError(error?.message ?? "No session found");
        return;
      }
      router.replace("/");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardBody className="text-center">
            {error ? (
              <Alert variant="error">Sign-in failed: {error}</Alert>
            ) : (
              <p className="text-sm text-foreground-muted">Signing you in&hellip;</p>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
