"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { Button, Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

type FeatureGroup = {
  title: string;
  items: { name: string; body: string }[];
};

const GROUPS: FeatureGroup[] = [
  {
    title: "Core security",
    items: [
      {
        name: "Zero-knowledge encryption",
        body: "AES-256-GCM with a key derived via PBKDF2 (250,000 iterations). Your master password never leaves your browser.",
      },
      {
        name: "Google Sign-In",
        body: "Identity only — proves who you are, has nothing to do with your encryption key.",
      },
      {
        name: "Master password + verifier",
        body: "A known value is encrypted at setup so returning visits can check your password locally, without ever storing it.",
      },
      {
        name: "Change master password",
        body: "Re-authenticates, then re-encrypts every saved entry under a new key in one atomic database transaction.",
      },
      {
        name: "Auto-lock",
        body: "The decryption key is cleared from memory after a configurable idle period, on logout, or when the tab closes.",
      },
      {
        name: "Escalating unlock lockout",
        body: "Repeated incorrect master-password attempts trigger a temporary, doubling lockout — a soft deterrent against guessing.",
      },
    ],
  },
  {
    title: "Vault management",
    items: [
      {
        name: "Add / edit / delete entries",
        body: "Site name, URL, username, password — soft-deleted, never hard-removed, so nothing vanishes by accident.",
      },
      {
        name: "Search",
        body: "Live filtering by site name, URL, or username as your vault grows.",
      },
      {
        name: "TOTP / 2FA codes",
        body: "Save a site's base32 TOTP secret and Padlock generates the live 6-digit code with a countdown, right on the dashboard.",
      },
      {
        name: "Secure notes",
        body: "A second entry type for anything that isn't a login — Wi-Fi passwords, recovery codes, PINs — encrypted the same way.",
      },
      {
        name: "Vault health check",
        body: "Flags weak, reused, and outdated (1+ year) passwords, computed entirely from data already decrypted in your browser.",
      },
      {
        name: "Password expiry reminders",
        body: "A dismissible dashboard banner nudges you to rotate passwords that haven't changed in over a year.",
      },
      {
        name: "Export & import",
        body: "Download your full vault as CSV or JSON, or bulk-import from either format — passwords are encrypted client-side either way.",
      },
    ],
  },
  {
    title: "Account & preferences",
    items: [
      {
        name: "Profile",
        body: "Account summary — email, sign-in provider, vault creation date, entry count, current lock status.",
      },
      {
        name: "Settings",
        body: "Theme (light/dark), auto-lock interval, and dashboard display preferences — synced through your account, not just one browser.",
      },
      {
        name: "Light / dark theme",
        body: "Applies instantly and persists across devices once you're signed in.",
      },
    ],
  },
  {
    title: "Browser extension",
    items: [
      {
        name: "Autofill",
        body: "Fill a login form from the popup with one click, matched to the site you're on by registrable domain.",
      },
      {
        name: "Right-click \"Fill with Padlock\"",
        body: "A live context menu scoped to the current tab — autofill without opening the popup at all.",
      },
      {
        name: "Click-a-field suggestions",
        body: "Focusing a username/password field shows a dropdown of saved logins for that site.",
      },
      {
        name: "Save-on-submit prompt",
        body: "Submitting a new or changed login shows an in-page \"Save this password?\" banner after the redirect.",
      },
      {
        name: "Password generator",
        body: "Length slider, charset toggles, and a live strength meter, built with crypto.getRandomValues.",
      },
      {
        name: "Copy to clipboard",
        body: "Copies a password with a 20-second auto-clear, checked both live and on next popup open.",
      },
      {
        name: "Draft recovery",
        body: "Typing in the Add/Edit form autosaves a draft, restored if the popup closes before you hit Save.",
      },
    ],
  },
];

export default function FeaturesPage() {
  const router = useRouter();
  const { key } = useKey();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={user?.email} />

      <PageContainer>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-700 dark:text-gold-500">
            Everything Padlock does
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-foreground sm:text-3xl">
            Features &amp; functionality
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-foreground-muted">
            A running list of what&apos;s built into the website and the browser extension so far.
          </p>
        </div>

        {GROUPS.map((group) => (
          <div key={group.title} className="mt-10">
            <h2 className="mb-4 border-b border-border pb-2 font-serif text-lg font-bold text-foreground">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Card key={item.name}>
                  <CardBody>
                    <h3 className="text-sm font-bold text-foreground">{item.name}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                      {item.body}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-10 text-center">
          <Button onClick={() => router.push(key ? "/dashboard" : user ? "/unlock" : "/login")}>
            {key ? "Go to your vault" : user ? "Unlock your vault" : "Get started"}
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
