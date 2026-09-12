"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SUPPORT_EMAIL } from "@/lib/seo";
import { Alert, Button, Card, CardBody, Input, SiteHeader, PageContainer } from "@/components/ui";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    setSubmitting(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }

    setSent(true);
    setSuccess("A verification code was sent to your email.");
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("The new account password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    if (verifyError) {
      setSubmitting(false);
      setError(verifyError.message);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Account password changed. You can now sign in with it.");
    setCode("");
    setPassword("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardBody>
            <h1 className="font-serif text-2xl font-bold text-foreground">Reset account password</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              We&apos;ll email you a one-time verification code.
            </p>

            <form onSubmit={sent ? resetPassword : sendCode} className="mt-6">
              <Input
                label="Account email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                disabled={sent}
              />

              {sent && (
                <>
                  <Input
                    label="Email verification code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    autoComplete="one-time-code"
                  />
                  <Input
                    label="New account password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </>
              )}

              {error && <Alert variant="error">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Please wait…" : sent ? "Change account password" : "Send code"}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-4 w-full text-xs font-semibold text-navy-700 hover:underline dark:text-gold-500"
            >
              Back to sign in
            </button>

            <div className="mt-6 border-t border-border pt-4 text-center">
              <p className="text-xs leading-relaxed text-foreground-muted">
                Need help accessing your account? Contact us at{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Padlock%20password%20help`}
                  className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                Support cannot recover or bypass a forgotten vault master password because it is
                never stored.
              </p>
            </div>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}