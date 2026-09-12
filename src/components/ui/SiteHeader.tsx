"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The header derives its own auth and vault-lock state rather than taking them
 * as props. Every page renders `<SiteHeader />` with no arguments and gets an
 * identical, complete header — previously each page passed its own props, so
 * pages that forgot them (add/edit entry, privacy, terms, and every loading
 * state) rendered a header with no navigation and no way back to the vault.
 */

type NavLink = {
  href: string;
  label: string;
  /** Matches child routes too, e.g. /dashboard/add is still "Vault". */
  matchPrefix?: string;
};

function navLinkClasses(active: boolean) {
  return [
    "rounded-sm px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
    active
      ? "bg-white/10 text-white"
      : "text-gray-200 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { key, clearKey } = useKey();

  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  /**
   * Menus store the route they were opened on rather than a plain boolean, so
   * navigating away closes them automatically — no effect needed to reset them.
   */
  const [accountOpenAt, setAccountOpenAt] = useState<string | null>(null);
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);

  const accountOpen = accountOpenAt === pathname;
  const mobileOpen = mobileOpenAt === pathname;

  const setAccountOpen = (open: boolean) => setAccountOpenAt(open ? pathname : null);
  const setMobileOpen = (open: boolean) => setMobileOpenAt(open ? pathname : null);

  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthResolved(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthResolved(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Dismiss the account menu on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpenAt(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpenAt(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearKey();
    setUser(null);
    router.replace("/login");
  }

  function handleLock() {
    clearKey();
    router.push("/unlock");
  }

  /**
   * "Vault" should always land somewhere useful: the dashboard when the vault
   * is open, the unlock screen when it is locked.
   */
  const vaultHref = key ? "/dashboard" : "/unlock";

  const signedInLinks: NavLink[] = [
    { href: vaultHref, label: "Vault", matchPrefix: "/dashboard" },
    { href: "/dashboard/notes", label: "Notes" },
    { href: "/features", label: "Features" },
    { href: "/install", label: "Install" },
  ];

  const signedOutLinks: NavLink[] = [
    { href: "/features", label: "Features" },
    { href: "/install", label: "Install" },
  ];

  const links = user ? signedInLinks : signedOutLinks;

  function isActive(link: NavLink) {
    if (link.label === "Notes") return pathname.startsWith("/dashboard/notes");
    if (link.matchPrefix) {
      // "Vault" owns /dashboard/* except the notes subtree, which has its own tab.
      return (
        pathname.startsWith(link.matchPrefix) && !pathname.startsWith("/dashboard/notes")
      );
    }
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "";

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy-900"
      >
        Skip to content
      </a>

      <div className="fixed inset-x-0 top-0 z-40">
        <div className="bg-gray-800 px-4 py-1.5 text-center text-xs text-gray-100 sm:px-8">
          An official-style zero-knowledge vault &mdash; your master password is never transmitted
          or stored.
        </div>

        <header className="border-b-4 border-header-border bg-header-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link
            href="/"
            className="flex flex-shrink-0 items-center gap-3 rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            aria-label="Padlock home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-sm border-2 border-gold-500 p-1">
              <svg viewBox="0 0 512 512" className="h-full w-full" aria-hidden="true">
                <path
                  d="M184 232 V182 a72 72 0 0 1 144 0 V232"
                  fill="none"
                  stroke="#ffbe2e"
                  strokeWidth="34"
                  strokeLinecap="round"
                />
                <rect x="150" y="224" width="212" height="166" rx="30" fill="#ffbe2e" />
                <circle cx="256" cy="284" r="24" fill="#0f2d52" />
                <rect x="244" y="300" width="24" height="54" rx="8" fill="#0f2d52" />
              </svg>
            </span>
            <span>
              <span className="block font-serif text-lg font-bold leading-tight text-white">
                Padlock
              </span>
              <span className="hidden text-[11px] uppercase tracking-widest text-gray-300 sm:block">
                Secure Credential Vault
              </span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={navLinkClasses(isActive(link))}
                aria-current={isActive(link) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Vault lock state — at-a-glance security status. */}
            {user && (
              <>
                {key ? (
                  <button
                    onClick={handleLock}
                    className="hidden items-center gap-1.5 rounded-full border border-green-400/40 bg-green-400/10 px-2.5 py-1 text-[11px] font-semibold text-green-300 transition-colors hover:bg-green-400/20 sm:inline-flex"
                    title="Vault is unlocked — click to lock it now"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
                    Unlocked
                  </button>
                ) : (
                  <Link
                    href="/unlock"
                    className="hidden items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-1 text-[11px] font-semibold text-gold-500 transition-colors hover:bg-gold-500/20 sm:inline-flex"
                    title="Vault is locked — click to unlock"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden="true" />
                    Locked
                  </Link>
                )}
              </>
            )}

            <ThemeToggle />

            {/* Account menu (signed in) */}
            {user && (
              <div ref={accountRef} className="relative hidden sm:block">
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  className="flex items-center gap-2 rounded-sm border border-white/20 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-navy-900">
                    {initials}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-sm border border-border bg-surface shadow-lg"
                  >
                    <div className="border-b border-border px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-muted">
                        Signed in as
                      </p>
                      <p className="truncate text-xs font-semibold text-foreground">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="block px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="block px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/dashboard/health"
                      role="menuitem"
                      className="block px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
                    >
                      Vault health
                    </Link>
                    <button
                      onClick={handleSignOut}
                      role="menuitem"
                      className="block w-full border-t border-border px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-surface-muted"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sign in (signed out) — hidden until auth resolves to avoid a flash. */}
            {authResolved && !user && (
              <Link
                href="/login"
                className="hidden rounded-sm border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 sm:inline-block"
              >
                Sign in
              </Link>
            )}

            {/* Mobile menu toggle — the nav was previously desktop-only, leaving
                phone users with no navigation at all. */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-sm border border-white/20 p-1.5 text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {mobileOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile navigation panel */}
        {mobileOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="border-t border-white/10 px-4 pb-4 sm:hidden"
          >
            {user && (
              <div className="flex items-center justify-between border-b border-white/10 py-3">
                <span className="truncate text-xs text-gray-300">{user.email}</span>
                <span
                  className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    key ? "bg-green-400/15 text-green-300" : "bg-gold-500/15 text-gold-500"
                  }`}
                >
                  {key ? "Unlocked" : "Locked"}
                </span>
              </div>
            )}

            <div className="flex flex-col py-1">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`rounded-sm px-2 py-2.5 text-sm font-semibold ${
                    isActive(link)
                      ? "bg-white/10 text-white"
                      : "text-gray-200 hover:bg-white/5 hover:text-white"
                  }`}
                  aria-current={isActive(link) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}

              {user ? (
                <>
                  <Link
                    href="/dashboard/health"
                    className="rounded-sm px-2 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/5 hover:text-white"
                  >
                    Vault health
                  </Link>
                  <Link
                    href="/profile"
                    className="rounded-sm px-2 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/5 hover:text-white"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="rounded-sm px-2 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/5 hover:text-white"
                  >
                    Settings
                  </Link>
                  {key && (
                    <button
                      onClick={handleLock}
                      className="rounded-sm px-2 py-2.5 text-left text-sm font-semibold text-gold-500 hover:bg-white/5"
                    >
                      Lock vault
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="mt-1 rounded-sm border-t border-white/10 px-2 py-2.5 text-left text-sm font-semibold text-red-400 hover:bg-white/5"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                authResolved && (
                  <Link
                    href="/login"
                    className="mt-1 rounded-sm bg-white/10 px-2 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Sign in
                  </Link>
                )
              )}
            </div>
          </nav>
        )}
        </header>
      </div>
      <div className="h-[96px]" aria-hidden="true" />
    </>
  );
}
