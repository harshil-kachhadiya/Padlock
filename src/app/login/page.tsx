"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
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
            <Link
              href="/forgot-password"
              className="mt-4 block text-xs font-semibold text-navy-700 hover:underline dark:text-gold-500"
            >
              Forgot account password?
            </Link>
            <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
              Your Padlock vault master password cannot be reset because it is never stored.
            </p>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
