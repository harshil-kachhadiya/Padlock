"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

const STEPS = [
  {
    title: "Add your first entry",
    body: "Save a site name, URL, username, and password — encrypted in your browser before it's sent anywhere.",
  },
  {
    title: "Install the browser extension",
    body: "Same vault, same encryption. Get autofill, a right-click fill menu, and a save prompt when you log into something new.",
  },
  {
    title: "Check your vault health",
    body: "Padlock flags weak, reused, and outdated passwords so you know what to fix first.",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserEmail(data.user.email ?? null);
    });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={userEmail} />

      <PageContainer className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardBody className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-700 dark:text-gold-500">
              Vault created
            </p>
            <h1 className="mt-2 font-serif text-2xl font-bold text-foreground">
              Welcome to Padlock
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Your zero-knowledge vault is ready. Here&apos;s how to get the most out of it.
            </p>

            <ol className="mt-6 space-y-4 text-left">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-sm border border-border bg-surface p-4">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <Button onClick={() => router.push("/dashboard")} className="mt-6 w-full">
              Go to my vault
            </Button>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
