import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, PageContainer, SiteHeader, SiteFooter } from "@/components/ui";
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import { HomeCta } from "./HomeClient";

export const metadata: Metadata = {
  title: "Padlock — Zero-Knowledge Password Manager with Browser Autofill",
  description:
    "A free password manager that cannot read your passwords. Padlock encrypts every credential in your browser with AES-256-GCM, so only ciphertext ever reaches our servers. Includes autofill, TOTP 2FA codes, and a password generator.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Padlock — Zero-Knowledge Password Manager with Browser Autofill",
    description:
      "A free password manager that cannot read your passwords. Everything is encrypted in your browser before it is sent anywhere.",
    url: SITE_URL,
    type: "website",
  },
};

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
    body: 'Autofill on any site, right-click "Fill with Padlock," a save prompt when you log in somewhere new, and a built-in password generator.',
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

/**
 * FAQ structured data. Every question/answer pair below is also rendered as
 * visible page copy — Google requires the marked-up content to be present on
 * the page, and mismatched FAQ markup is a manual-action risk.
 */
const FAQS = [
  {
    question: "What does zero-knowledge actually mean?",
    answer:
      "It means Padlock's servers never receive your master password or any readable version of your saved passwords. Encryption and decryption happen entirely in your browser, so the database only ever holds ciphertext that we have no key for.",
  },
  {
    question: "What happens if I forget my master password?",
    answer:
      "Your vault cannot be recovered. Because your master password is never transmitted or stored, there is no reset link and no support process that can decrypt your data. Write it down and keep it somewhere safe.",
  },
  {
    question: "Is Padlock free to use?",
    answer:
      "Yes. Both the website and the browser extension are free, and there is no paid tier, no advertising, and no selling of user data.",
  },
  {
    question: "Which browsers does the extension support?",
    answer:
      "Any Chromium-based browser with Manifest V3 support, including Google Chrome, Microsoft Edge, and Brave.",
  },
  {
    question: "Can Padlock generate two-factor authentication codes?",
    answer:
      "Yes. Padlock includes a built-in TOTP generator following RFC 6238, so you can store a site's 2FA setup key and generate live six-digit codes without a separate authenticator app.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": absoluteUrl("/#faq"),
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      <SiteHeader />

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

        <HomeCta />
      </PageContainer>

      {/* Features */}
      <PageContainer>
        <h2 className="text-center font-serif text-xl font-bold text-foreground">
          Encrypted password management, end to end
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
        <p className="mt-6 text-center text-xs text-foreground-muted">
          <Link
            href="/features"
            className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
          >
            See the full feature list
          </Link>
        </p>
      </PageContainer>

      {/* How it works / user guide */}
      <PageContainer>
        <h2 className="text-center font-serif text-xl font-bold text-foreground">
          How to set up your encrypted vault
        </h2>
        <ol className="mx-auto mt-6 max-w-2xl space-y-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-sm border border-border bg-surface p-4"
            >
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
              How Padlock&rsquo;s AES-256 encryption works
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              Your master password never leaves your browser. Instead, it&rsquo;s run through{" "}
              <strong className="text-foreground">PBKDF2 with 250,000 iterations</strong> and a
              random salt to derive an <strong className="text-foreground">AES-256</strong>{" "}
              encryption key — entirely on your device, using the browser&rsquo;s native Web
              Crypto API.
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
              On your next visit, we re-derive the same key from your password and try to decrypt
              a small stored &ldquo;verifier&rdquo; value — if it matches, your password was
              correct. Your master password itself is never compared, stored, or transmitted at
              any point.
            </p>
          </CardBody>
        </Card>
      </PageContainer>

      {/* FAQ — visible copy backing the FAQPage structured data */}
      <PageContainer>
        <h2 className="text-center font-serif text-xl font-bold text-foreground">
          Frequently asked questions
        </h2>
        <div className="mx-auto mt-6 max-w-2xl space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="rounded-sm border border-border bg-surface p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                {faq.question}
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{faq.answer}</p>
            </details>
          ))}
        </div>
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
