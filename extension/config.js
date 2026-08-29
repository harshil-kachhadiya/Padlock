// Public config only — the anon key is safe to ship client-side, RLS enforces access control.
const PADLOCK_CONFIG = {
  SUPABASE_URL: "https://zfaisbajepehsrnjkpwc.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmYWlzYmFqZXBlaHNybmprcHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIxODgsImV4cCI6MjEwMzU2ODE4OH0.hgxAyO1QJmpkXvnxjYb1iT1og--N6huEk__2Xuv-gHk",
  WEBSITE_URL: "http://localhost:3000",
  AUTO_LOCK_MS: 5 * 60 * 1000,
};
