import { Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Padlock handles your data: your master password never leaves your browser, saved passwords are stored only as ciphertext we cannot decrypt, and we never sell user data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="max-w-3xl">
        <h1 className="font-serif text-2xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-1 text-sm text-foreground-muted">Last updated: August 30, 2026</p>

        <Card className="mt-6">
          <CardBody className="space-y-6 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="mb-2 text-base font-bold">Summary</h2>
              <p>
                Padlock is a zero-knowledge password manager. Your master password is created and
                verified entirely in your browser or extension — it is never transmitted to us,
                and we have no way to recover it. Every saved password and note is encrypted on
                your device before it is sent to our database.{" "}
                <strong>We never store your passwords in plain text on our servers — only
                ciphertext that we cannot read.</strong>
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">What we collect</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Identity information</strong> from Google Sign-In (via Supabase Auth):
                  your email address and Google account ID. Used only to identify your account.
                </li>
                <li>
                  <strong>Encrypted vault data</strong>: site names/URLs and usernames are stored
                  as plain text (they are not secret); passwords, TOTP secrets, and secure notes
                  are stored only as AES-256-GCM ciphertext we cannot decrypt.
                </li>
                <li>
                  <strong>A random salt and an encrypted &ldquo;verifier&rdquo;</strong>, used to
                  check a returning master password locally without ever storing it.
                </li>
                <li>
                  <strong>Your preferences</strong> (theme, auto-lock timing, display settings).
                </li>
                <li>
                  <strong>Optional uninstall feedback</strong>: if you choose to tell us why you
                  removed the browser extension, that reason/message is stored without being
                  linked to your account.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">What we never collect</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Your master password — never transmitted, never stored, in any form.</li>
                <li>Plaintext passwords, TOTP secrets, or note content — encrypted before leaving your device.</li>
                <li>Browsing history. The extension only reads the current page to detect login forms when you actively use autofill or the save prompt.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Browser extension permissions</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Host permissions (all sites)</strong> — required so autofill, the
                  right-click fill menu, and the save-password prompt can work on any site you
                  choose to use them on. The extension does not read or transmit page content
                  except the specific form fields involved in an autofill/save action you initiate.
                </li>
                <li>
                  <strong>storage</strong> — keeps your session and cached vault key only in
                  memory (cleared on browser close) or on your device.
                </li>
                <li>
                  <strong>identity</strong> — used solely for the Google Sign-In flow.
                </li>
                <li>
                  <strong>contextMenus</strong> — powers the right-click &ldquo;Fill with
                  Padlock&rdquo; menu.
                </li>
                <li>
                  <strong>tabs</strong> — used to match the site you&apos;re on against your saved
                  entries so the right ones are suggested.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Third parties</h2>
              <p>
                We use <strong>Supabase</strong> for authentication and database hosting, and{" "}
                <strong>Google</strong> for sign-in identity verification. We do not sell your data
                or share it with any other third party.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Your data, your control</h2>
              <p>
                You can export your entire vault (as CSV or JSON) at any time from the dashboard.
                To request deletion of your account and all associated data, contact us at the
                email below.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Contact</h2>
              <p>Questions about this policy: harshil23kachhadiya@gmail.com</p>
            </section>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
