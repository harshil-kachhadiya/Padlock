"use client";

import { supabase } from "@/lib/supabaseClient";
import { Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

export default function LoginPage() {
  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardBody className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground">Sign in</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Verify your identity to continue to Padlock.
            </p>
            <Button onClick={handleGoogleSignIn} className="mt-6 w-full">
              Sign in with Google
            </Button>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
