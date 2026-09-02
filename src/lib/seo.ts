/**
 * Central SEO configuration.
 *
 * NEXT_PUBLIC_SITE_URL must be set in production to the live origin (no trailing
 * slash) — canonical URLs, the sitemap, and Open Graph image URLs are all built
 * from it. It falls back to the current Vercel deployment so canonicals never
 * point at a domain that isn't serving the site yet.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://padlock.extention.in"
).replace(/\/$/, "");

export const SITE_NAME = "Padlock";

export const SITE_TAGLINE = "Zero-Knowledge Password Manager";

export const SITE_DESCRIPTION =
  "Padlock is a zero-knowledge password manager. Your master password never leaves your browser — everything is encrypted locally with AES-256-GCM, so our servers only ever store ciphertext we cannot read.";

export const SUPPORT_EMAIL = "harshil23kachhadiya@gmail.com";

/** Chrome Web Store item ID, used for outbound install links and sameAs. */
export const CHROME_EXTENSION_ID = "jigllelbimfkinedfpcdcmnlodggohig";

export const CHROME_STORE_URL = `https://chromewebstore.google.com/detail/${CHROME_EXTENSION_ID}`;

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Routes that must never be indexed: anything behind auth, anything that
 * renders decrypted vault data, and OAuth/dev endpoints.
 */
export const NOINDEX_PATHS = [
  "/dashboard",
  "/settings",
  "/profile",
  "/unlock",
  "/setup",
  "/login",
  "/welcome",
  "/auth",
  "/extension",
  "/crypto-test",
  "/api",
];
