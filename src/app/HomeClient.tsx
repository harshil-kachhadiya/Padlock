"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { ButtonLink } from "@/components/ui";

/**
 * Only the primary CTA depends on auth state — the header manages its own.
 * All indexable copy lives in the server component so it renders in the
 * initial HTML without waiting on hydration.
 */
export function HomeCta() {
  const { key } = useKey();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const cta = !user
    ? { label: "Sign in with Google", href: "/login" }
    : !key
      ? { label: "Set up / unlock vault", href: "/unlock" }
      : { label: "Go to your vault", href: "/dashboard" };

  return (
    <>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {loading ? (
          <span className="text-sm text-foreground-muted">Loading&hellip;</span>
        ) : (
          <>
            <ButtonLink href={cta.href} className="min-w-[220px]">
              {cta.label}
            </ButtonLink>
            <ButtonLink href="/install" variant="secondary" className="min-w-[220px]">
              Get the browser extension
            </ButtonLink>
          </>
        )}
      </div>

      {user && (
        <p className="mt-3 text-xs text-foreground-muted">
          Signed in as {user.email} &middot; Vault{" "}
          <span className={key ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
            {key ? "unlocked" : "locked"}
          </span>
        </p>
      )}
    </>
  );
}
