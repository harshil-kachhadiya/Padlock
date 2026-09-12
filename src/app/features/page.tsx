import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, PageContainer, SiteHeader, SiteFooter } from "@/components/ui";
import { absoluteUrl } from "@/lib/seo";
import { FeaturesCta } from "./FeaturesClient";

export const metadata: Metadata = {
  title: "Features — Autofill, TOTP 2FA, Vault Health & Secure Notes",
  description:
    "Every feature built into Padlock: zero-knowledge AES-256 encryption, one-click autofill, built-in TOTP two-factor codes, a password generator, vault health checks, encrypted notes, and CSV/JSON import and export.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Padlock Features — Autofill, TOTP 2FA, Vault Health & Secure Notes",
    description:
      "Zero-knowledge encryption, autofill, TOTP codes, a password generator, vault health checks, and encrypted notes.",
    url: "/features",
    type: "website",
  },
};

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
        body: "AES-256-GCM with a key derived via PBKDF2-SHA-256. New vaults use 600,000 iterations, while each vault keeps its stored iteration count. Your master password never leaves your browser.",
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
        name: "Session controls",
        body: "Sign out other active sessions while keeping the current device signed in, or sign out everywhere when you need a complete reset.",
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
        body: "Auto-lock interval, dashboard display preferences, extension autofill behavior, and security controls — synced through your account.",
      },
      {
        name: "Light / dark theme",
        body: "Switch themes instantly from the header with one toggle; the system theme is the default and follows your device preference.",
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
        name: "Automatic single-login autofill",
        body: "When exactly one credential matches the current HTTPS hostname, Padlock fills empty login fields automatically as the page loads — no popup click required.",
      },
      {
        name: "Autofill safety controls",
        body: "Automatic autofill is limited to HTTPS pages and exact hostnames, never overwrites fields you already filled, and can be disabled for any individual site.",
      },
      {
        name: "Lock status indicator",
        body: "The extension header clearly shows whether your vault is locked or unlocked before any credential action is available.",
      },
      {
        name: "Update notifications",
        body: "The extension notifies you when a new version is available so you can reload and use the latest security and compatibility fixes.",
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


/**
 * BreadcrumbList tells Google the site hierarchy. It powers the breadcrumb
 * trail shown in results and is one of the signals feeding sitelink
 * generation — unlike sitelinks themselves, it is markup we control.
 */
const breadcrumbStructuredData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Features", item: absoluteUrl("/features") },
  ],
};

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />

      <SiteHeader />

      <PageContainer>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-700 dark:text-gold-500">
            Everything Padlock does
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-foreground sm:text-3xl">
            Padlock features &amp; functionality
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-foreground-muted">
            Everything built into the{" "}
            <Link href="/" className="font-semibold text-navy-700 hover:underline dark:text-gold-500">
              Padlock password manager
            </Link>{" "}
            website and its browser extension — all of it running on the same zero-knowledge
            encrypted vault.
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
          <FeaturesCta />
        </div>
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
