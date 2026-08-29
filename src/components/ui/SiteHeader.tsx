"use client";

import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

type SiteHeaderProps = {
  userEmail?: string | null;
  onSignOut?: () => void;
};

export function SiteHeader({ userEmail, onSignOut }: SiteHeaderProps) {
  const router = useRouter();

  return (
    <>
      <div className="bg-gray-800 px-4 py-1.5 text-center text-xs text-gray-100 sm:px-8">
        An official-style zero-knowledge vault &mdash; your master password is never transmitted
        or stored.
      </div>
      <header className="border-b-4 border-header-border bg-header-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-sm border-2 border-gold-500 p-1.5">
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
              <span className="block text-[11px] uppercase tracking-widest text-gray-300">
                Secure Credential Vault
              </span>
            </span>
          </button>

          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-3 sm:flex">
              <button
                onClick={() => router.push("/features")}
                className="text-xs font-semibold text-gray-200 hover:text-white"
              >
                Features
              </button>
              {userEmail && (
                <>
                  <button
                    onClick={() => router.push("/profile")}
                    className="text-xs font-semibold text-gray-200 hover:text-white"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => router.push("/settings")}
                    className="text-xs font-semibold text-gray-200 hover:text-white"
                  >
                    Settings
                  </button>
                </>
              )}
            </nav>
            {userEmail && (
              <span className="hidden text-xs text-gray-300 sm:inline">{userEmail}</span>
            )}
            <ThemeToggle />
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="rounded-sm border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
