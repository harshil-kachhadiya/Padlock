"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

const FEATURES = [
  {
    title: "Google Sign-In",
    body: "Identity only. Signing in with Google proves who you are — it never touches your passwords or your encryption key.",
  },
  {
    title: "Your Master Password",
    body: "Chosen once, known only to you. It's never sent to our servers, never stored anywhere — not in the database, not in a cookie, not in local storage.",
  },
  {
    title: "AES-256-GCM Encryption",
    body: "Every saved password is encrypted in your browser with a key derived from your master password before it ever leaves your device.",
  },
  {
    title: "Zero-Knowledge by Design",
    body: "Our database only ever stores ciphertext. Even with full access to it, nobody — including us — can read your saved passwords.",
  },
  {
    title: "Auto-Lock",
    body: "Your decryption key lives only in memory and is automatically cleared after 5 minutes of inactivity, on logout, or when you close the tab.",
  },
  {
    title: "Browser Extension",
    body: "Autofill on any site, right-click \"Fill with Padlock,\" a save prompt when you log in somewhere new, and a built-in password generator.",
  },
];

const STEPS = [
  {
    title: "Sign in with Google",
    body: "Verifies your identity through Supabase Auth. This step has nothing to do with encryption.",
  },
  {
    title: "Create your master password",
    body: "Done once. This password derives your personal encryption key — write it down somewhere safe, because it cannot be recovered.",
  },
  {
    title: "Add your saved logins",
    body: "Site name, URL, username, and password. Everything is encrypted in your browser before it's saved.",
  },
  {
    title: "Unlock anytime",
    body: "Re-enter your master password whenever your session locks. It's checked locally — never sent anywhere.",
  },
  {
    title: "Install the browser extension",
    body: "Same vault, same encryption. Get autofill, a right-click fill menu, and a password generator on top.",
  },
];

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

  function primaryCta() {
    if (!user) return { label: "Sign in with Google", href: "/login" };
    if (!key) return { label: "Set up / unlock vault", href: "/unlock" };
    return { label: "Go to your vault", href: "/dashboard" };
  }

  const cta = primaryCta();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={user?.email} onSignOut={user ? handleSignOut : undefined} />

      {/* Hero */}
      <PageContainer className="pb-0 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-700 dark:text-gold-500">
          Zero-Knowledge Credential Vault
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl font-serif text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          A password manager that cannot read your passwords.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-foreground-muted sm:text-base">
          Padlock encrypts every credential in your browser with a key only you hold. Our
          servers only ever see ciphertext — not your master password, not your data.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {loading ? (
            <span className="text-sm text-foreground-muted">Loading&hellip;</span>
          ) : (
            <Button onClick={() => router.push(cta.href)} className="min-w-[220px]">
              {cta.label}
            </Button>
          )}
        </div>

        {user && (
          <p className="mt-3 text-xs text-foreground-muted">
            Signed in as {user.email} · Vault{" "}
            <span className={key ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
              {key ? "unlocked" : "locked"}
            </span>
          </p>
        )}
      </PageContainer>

      {/* Features */}
      <PageContainer>
        <h2 className="text-center font-serif text-xl font-bold text-foreground">
          What you get
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardBody>
                <h3 className="text-sm font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                  {feature.body}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </PageContainer>

      {/* How it works / user guide */}
      <PageContainer>
        <h2 className="text-center font-serif text-xl font-bold text-foreground">
          How it works
        </h2>
        <ol className="mx-auto mt-6 max-w-2xl space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 rounded-sm border border-border bg-surface p-4">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </PageContainer>

      {/* Security model */}
      <PageContainer>
        <Card>
          <CardBody>
            <h2 className="font-serif text-xl font-bold text-foreground">
              How the encryption actually works
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              Your master password never leaves your browser. Instead, it's run through{" "}
              <strong className="text-foreground">PBKDF2 with 250,000 iterations</strong> and a
              random salt to derive an <strong className="text-foreground">AES-256</strong>{" "}
              encryption key — entirely on your device, using the browser's native Web Crypto
              API.
            </p>

            <div className="mt-5 flex flex-col items-stretch gap-2 overflow-x-auto text-xs font-semibold sm:flex-row sm:items-center sm:justify-center">
              {[
                "Master password",
                "PBKDF2 (250k iterations)",
                "AES-256 key",
                "Encrypt in browser",
                "Ciphertext to server",
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="whitespace-nowrap rounded-sm border border-border bg-surface-muted px-3 py-1.5 text-foreground">
                    {step}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="hidden text-foreground-muted sm:inline">&rarr;</span>
                  )}
                </span>
              ))}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-foreground-muted">
              On your next visit, we re-derive the same key from your password and try to
              decrypt a small stored &ldquo;verifier&rdquo; value — if it matches, your password
              was correct. Your master password itself is never compared, stored, or
              transmitted at any point.
            </p>
          </CardBody>
        </Card>
      </PageContainer>

      <footer className="mt-auto border-t border-border py-6 text-center text-xs text-foreground-muted">
        <p>Padlock — your master password never leaves your device.</p>
        <button
          onClick={() => router.push("/privacy")}
          className="mt-2 font-semibold text-navy-700 hover:underline dark:text-gold-500"
        >
          Privacy Policy
        </button>
      </footer>
    </div>
  );
}
