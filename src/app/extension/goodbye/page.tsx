"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

const REASONS = [
  "It was too complicated",
  "I found something else I prefer",
  "Privacy or trust concerns",
  "I ran into a bug or error",
  "I just don't need it anymore",
  "Other",
];

export default function ExtensionGoodbyePage() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/extension-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, message }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Couldn't send feedback — please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Couldn't send feedback — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Thanks for trying Padlock
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              You&apos;ve removed the Padlock extension. Your encrypted vault is safe — nothing
              was deleted, and you can pick up right where you left off any time.
            </p>

            {submitted ? (
              <div className="mt-6">
                <Alert variant="success">
                  Thanks for letting us know — it genuinely helps.
                </Alert>
                <Button onClick={() => router.push("/")} className="w-full">
                  Come back anytime
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 text-left">
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Mind telling us why? (optional)
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mb-4 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/30"
                >
                  <option value="">Select a reason&hellip;</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Anything else you'd like us to know?"
                  className="mb-4 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-navy-700 focus:ring-2 focus:ring-navy-700/30"
                />

                {error && <Alert variant="error">{error}</Alert>}

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? "Sending…" : "Send feedback"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push("/")}
                  >
                    Skip
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
