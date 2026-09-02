import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  Card,
  CardBody,
  PageContainer,
  SiteFooter,
  SiteHeader,
} from "@/components/ui";
import { absoluteUrl } from "@/lib/seo";
import manifest from "../../../extension/manifest.json";

export const metadata: Metadata = {
  title: "Install the Padlock Browser Extension",
  description:
    "Download the Padlock browser extension and load it in Chrome, Edge, or Brave. Step-by-step instructions for installing the zero-knowledge password manager extension while the Chrome Web Store listing is under review.",
  alternates: { canonical: "/install" },
  openGraph: {
    title: "Install the Padlock Browser Extension",
    description:
      "Download the Padlock extension and load it in any Chromium browser in under a minute.",
    url: "/install",
    type: "website",
  },
};

const DOWNLOAD_PATH = "/padlock-extension.zip";

const STEPS = [
  {
    title: "Download and unzip",
    body: "Download the file below, then extract it. Chrome needs an unzipped folder — it cannot load a .zip file directly.",
  },
  {
    title: "Open your browser's extensions page",
    body: "Go to chrome://extensions in Chrome, edge://extensions in Edge, or brave://extensions in Brave. Paste it into the address bar — links to these pages cannot be clicked for security reasons.",
  },
  {
    title: "Turn on Developer mode",
    body: "Use the Developer mode toggle in the top-right corner of that page.",
  },
  {
    title: 'Click "Load unpacked"',
    body: "A button appears in the top-left once Developer mode is on. Select the folder you extracted — the one containing manifest.json, not its parent.",
  },
  {
    title: "Pin it and sign in",
    body: "Padlock now appears in your extensions. Pin it to your toolbar, click the icon, and sign in with the same Google account you use on this site. Your vault syncs automatically.",
  },
];

const howToStructuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "@id": absoluteUrl("/install#howto"),
  name: "Install the Padlock browser extension",
  description:
    "How to download the Padlock extension and load it as an unpacked extension in a Chromium-based browser.",
  totalTime: "PT2M",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToStructuredData) }}
      />

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
            <a
              href={DOWNLOAD_PATH}
              download
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-navy-900 bg-navy-800 px-6 py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-navy-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
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
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Download extension v{manifest.version}
            </a>
            <p className="mt-3 text-xs text-foreground-muted">
              padlock-extension.zip &middot; Chrome, Edge, Brave, and other Chromium browsers
            </p>
          </CardBody>
        </Card>

        <Alert variant="info">
          The Chrome Web Store listing is still under review, so for now the extension
          installs manually. Two things to know: Chrome will show a &ldquo;disable developer
          mode extensions&rdquo; notice on startup, and a manually loaded extension does not
          auto-update &mdash; you will need to download it again when a new version ships.
        </Alert>

        <h2 className="mt-10 font-serif text-xl font-bold text-foreground">
          How to load it &mdash; about two minutes
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

        <Card className="mt-10">
          <CardBody>
            <h2 className="font-serif text-lg font-bold text-foreground">
              Is loading it manually safe?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              &ldquo;Load unpacked&rdquo; is the standard way developers run extensions, and
              it is the same code that will ship to the Chrome Web Store. Because the folder
              is unpacked on your own machine, you can read every file in it before you load
              it &mdash; including{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">crypto.js</code>,
              which does the encryption. Nothing is minified or obfuscated.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              The security model does not change: your master password is still derived into
              a key locally and never sent anywhere, and the extension only ever transmits
              ciphertext. See the{" "}
              <Link
                href="/privacy"
                className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
              >
                privacy policy
              </Link>{" "}
              for exactly what each permission is used for.
            </p>
          </CardBody>
        </Card>

        <p className="mt-8 text-center text-xs text-foreground-muted">
          Prefer to wait for the official store listing? You can{" "}
          <Link
            href="/"
            className="font-semibold text-navy-700 hover:underline dark:text-gold-500"
          >
            use Padlock on the web
          </Link>{" "}
          in the meantime &mdash; same vault, same encryption.
        </p>
      </PageContainer>

      <SiteFooter />
    </div>
  );
}
