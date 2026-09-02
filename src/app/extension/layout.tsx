import type { Metadata } from "next";

/**
 * Authenticated / non-marketing surface: never index. Page components in this
 * segment are client components and cannot export metadata themselves, so the
 * robots directive lives here in the segment layout.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function ExtensionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
