import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    /**
     * PKCE instead of the implicit flow.
     *
     * The implicit flow returns the session in the URL fragment
     * (#access_token=…&refresh_token=…), which leaks credentials into browser
     * history, the address bar, screenshots, and anything the user copies and
     * pastes. PKCE returns a short-lived single-use ?code= instead, exchanged
     * for the session over a POST, so tokens never appear in the URL.
     */
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
