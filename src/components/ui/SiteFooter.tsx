import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

/**
 * Shared footer. Rendering the same public links on every page gives the site
 * a consistent internal link graph — previously only the homepage and
 * /features had a footer, so /privacy and /terms were nearly orphaned.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border py-6 text-center text-xs text-foreground-muted">
      <p>{SITE_NAME} &mdash; your master password never leaves your device.</p>
      <nav aria-label="Footer" className="mt-2 flex flex-wrap justify-center gap-4 font-semibold">
        <Link href="/" className="text-navy-700 hover:underline dark:text-gold-500">
          Home
        </Link>
        <Link href="/features" className="text-navy-700 hover:underline dark:text-gold-500">
          Features
        </Link>
        <Link href="/privacy" className="text-navy-700 hover:underline dark:text-gold-500">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-navy-700 hover:underline dark:text-gold-500">
          Terms of Service
        </Link>
      </nav>
    </footer>
  );
}
