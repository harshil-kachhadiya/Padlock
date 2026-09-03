import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  PageContainer,
  SiteFooter,
  SiteHeader,
} from "@/components/ui";
import { CHROME_STORE_URL, EXTENSION_PUBLISHED, absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Install the Padlock Browser Extension",
  description:
    "Add the Padlock extension to Chrome, Edge, or Brave. Autofill, a right-click fill menu, save-on-submit prompts, and TOTP two-factor codes, all running on the same zero-knowledge encrypted vault.",
  alternates: { canonical: "/install" },
  openGraph: {
    title: "Install the Padlock Browser Extension",
    description:
      "Add Padlock to your browser for autofill, 2FA codes, and a password generator — free.",
    url: "/install",
    type: "website",
  },
};

const STEPS = [
  {
    title: "Add it from the Chrome Web Store",
    body: "Click the button above. The store page opens, and you install with Add to Chrome — the same as any other extension.",
  },
  {
    title: "Pin Padlock to your toolbar",
    body: "Click the extensions icon in your browser's toolbar, then the pin next to Padlock so it stays one click away.",
  },
  {
    title: "Sign in and unlock",
    body: "Click the Padlock icon and sign in with the same Google account you use here, then enter your master password. Your vault syncs automatically — the extension and this site share one encrypted vault.",
  },
];

const howToStructuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "@id": absoluteUrl("/install#howto"),
  name: "Install the Padlock browser extension",
  description:
    "How to add the Padlock password manager extension to a Chromium-based browser and sign in to your vault.",
  totalTime: "PT1M",
  step: STEPS.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.body,
  })),
};

export default function InstallPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* HowTo steps assume a working store install — publishing them before
          the listing is live would describe a button that 404s. */}
      {EXTENSION_PUBLISHED && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToStructuredData) }}
        />
      )}

      <SiteHeader />

      <PageContainer className="max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-700 dark:text-gold-500">
            Browser Extension
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-foreground sm:text-3xl">
            Install the Padlock extension
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted">
            Autofill, a right-click fill menu, save-on-submit prompts, and a password
            generator — running on the same{" "}
            <Link
              href="/features"
              className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
            >
              zero-knowledge vault
            </Link>{" "}
            as this site.
          </p>
        </div>

        <Card className="mt-8">
          <CardBody className="text-center">
            {EXTENSION_PUBLISHED ? (
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-sm border border-navy-900 bg-navy-800 px-6 py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-navy-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  <path d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.76 3.47L3.5 4.9A10 10 0 0 1 12 2Zm10 10a10 10 0 0 1-9.34 9.98l3.9-6.75A5 5 0 0 0 17 12h5ZM2 12a10 10 0 0 0 8.2 9.83L6.3 15.1A5 5 0 0 1 2.02 11.3L2 12Zm10 3a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
                </svg>
                Add to Chrome — free
              </a>
            ) : (
              <>
                <span
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-border bg-surface-muted px-6 py-3 text-sm font-semibold tracking-wide text-foreground-muted"
                  aria-disabled="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  Coming soon to the Chrome Web Store
                </span>
                <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
                  Padlock&rsquo;s listing is currently under review. In the meantime, you can{" "}
                  <Link
                    href="/"
                    className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
                  >
                    use Padlock on the web
                  </Link>{" "}
                  &mdash; same vault, same encryption, no extension required.
                </p>
              </>
            )}
            {EXTENSION_PUBLISHED && (
              <p className="mt-3 text-xs text-foreground-muted">
                Works in Chrome, Edge, Brave, and other Chromium browsers
              </p>
            )}
          </CardBody>
        </Card>

        {EXTENSION_PUBLISHED && (
          <>
            <h2 className="mt-10 font-serif text-xl font-bold text-foreground">
              Getting set up &mdash; about a minute
            </h2>
            <ol className="mt-5 space-y-4">
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
                    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        <Card className="mt-10">
          <CardBody>
            <h2 className="font-serif text-lg font-bold text-foreground">
              What the extension can and cannot see
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              The extension needs access to the sites you visit so it can find login fields and
              fill them. It does not read or transmit page content beyond the specific fields
              involved in an autofill or save action you start yourself.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              The security model is identical to the website: your master password is derived
              into a key on your own device and never sent anywhere, and only ciphertext is ever
              transmitted. The{" "}
              <Link
                href="/privacy"
                className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
              >
                privacy policy
              </Link>{" "}
              breaks down exactly what each permission is used for.
            </p>
          </CardBody>
        </Card>

        {EXTENSION_PUBLISHED && (
          <p className="mt-8 text-center text-xs text-foreground-muted">
            Don&rsquo;t want an extension? You can{" "}
            <Link
              href="/"
              className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
            >
              use Padlock on the web
            </Link>{" "}
            instead &mdash; same vault, same encryption.
          </p>
        )}
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
