import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { KeyProvider } from "@/lib/keyContext";
import { ThemeProvider } from "@/lib/themeContext";
import { SettingsProvider, SettingsSync } from "@/lib/settingsContext";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  CHROME_STORE_URL,
  EXTENSION_PUBLISHED,
  absoluteUrl,
} from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE} with Browser Autofill`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Harshil Kachhadiya" }],
  creator: "Harshil Kachhadiya",
  publisher: SITE_NAME,
  keywords: [
    "zero-knowledge password manager",
    "encrypted password manager",
    "end-to-end encrypted vault",
    "browser password autofill",
    "AES-256 password manager",
    "open password manager extension",
    "TOTP authenticator",
    "secure credential vault",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE} with Browser Autofill`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "security",
};

/**
 * Organization + SoftwareApplication structured data. Deliberately omits
 * aggregateRating / reviewCount — the extension has no reviews yet, and
 * fabricating them is both a rich-results violation and a Play/CWS policy risk.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      // Only cite the store listing once it resolves — pointing search engines
      // at a page that 404s does more harm than omitting the field.
      ...(EXTENSION_PUBLISHED ? { sameAs: [CHROME_STORE_URL] } : {}),
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": absoluteUrl("/#organization") },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": absoluteUrl("/#software"),
      name: SITE_NAME,
      applicationCategory: "SecurityApplication",
      applicationSubCategory: "Password Manager",
      operatingSystem: "Chrome, Edge, Brave, Web",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      ...(EXTENSION_PUBLISHED ? { installUrl: CHROME_STORE_URL } : {}),
      browserRequirements: "Requires a Chromium-based browser with Manifest V3 support.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Zero-knowledge AES-256-GCM encryption",
        "Password autofill on any website",
        "Built-in TOTP two-factor code generator",
        "Strong password generator",
        "Vault health and password reuse checks",
        "Encrypted secure notes",
        "CSV and JSON import and export",
      ],
      publisher: { "@id": absoluteUrl("/#organization") },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          // Static, developer-authored object — no user input is interpolated.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <KeyProvider>
            <SettingsProvider>
              <SettingsSync>{children}</SettingsSync>
            </SettingsProvider>
          </KeyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
