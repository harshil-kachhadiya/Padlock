"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useKey } from "@/lib/keyContext";
import { ButtonLink } from "@/components/ui";

/** Auth-dependent CTA only — the header manages its own state. */
export function FeaturesCta() {
  const { key } = useKey();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const href = key ? "/dashboard" : user ? "/unlock" : "/login";
  const label = key ? "Go to your vault" : user ? "Unlock your vault" : "Get started";

  return <ButtonLink href={href}>{label}</ButtonLink>;
}
