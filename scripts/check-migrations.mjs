/**
 * Diagnoses which of migrations 0010-0014 have actually been applied to the
 * live database, instead of guessing or re-running SQL that might already
 * be in place. Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS — this is a
 * local diagnostic only; never expose that key client-side.
 *
 * Run: node scripts/check-migrations.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const rawLine of readFileSync(".env.local", "utf8").split("\n")) {
    // .trim() first: on a CRLF file split("\n") leaves a trailing \r on
    // every line, and since JS regex "." never matches a line terminator
    // (\r included), an untrimmed line's trailing \r stops (.*)$ from ever
    // matching at all — every line silently failed to parse.
    const line = rawLine.trim();
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The service role key is required here specifically to bypass RLS — the anon\n" +
      "key would report false negatives on setting_items (its select policy is\n" +
      "'to authenticated', so an unauthenticated check can't tell missing rows\n" +
      "apart from rows RLS is just hiding)."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const UNDEFINED_COLUMN = "42703"; // Postgres error code

/** True if the column exists, false if Postgres reports it doesn't, throws otherwise. */
async function columnExists(table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;
  if (error.code === UNDEFINED_COLUMN) return false;
  throw new Error(`Unexpected error checking ${table}.${column}: ${error.message}`);
}

async function settingItemExists(key) {
  const { data, error } = await supabase.from("setting_items").select("key").eq("key", key);
  if (error) throw new Error(`Unexpected error checking setting_items '${key}': ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * change_master_password's old (0002) signature took 3 args; 0011 adds a
 * 4th (p_pbkdf2_iterations). Calling it to find out would require real
 * salt/verifier/password data and would mutate a user's row, so this reads
 * information_schema.parameters instead — read-only, no side effects.
 * PostgREST doesn't always expose information_schema, so this degrades to
 * "couldn't check" rather than failing the whole script if it isn't.
 */
async function checkFunctionSignature() {
  const { data, error } = await supabase
    .from("information_schema.parameters")
    .select("parameter_name")
    .eq("specific_schema", "public")
    .ilike("specific_name", "change_master_password%");

  if (error) {
    // information_schema is often not exposed through PostgREST by default;
    // this check is best-effort and should degrade quietly, not fail the
    // whole script over it.
    return null;
  }
  const names = (data ?? []).map((r) => r.parameter_name);
  if (names.length === 0) return null;
  return names.includes("p_pbkdf2_iterations");
}

function report(label, status, migration) {
  const icon = status === true ? "\x1b[32m✓\x1b[0m" : status === false ? "\x1b[31m✗\x1b[0m" : "\x1b[33m?\x1b[0m";
  const suffix = status === false ? `  (run ${migration})` : status === null ? "  (couldn't check)" : "";
  console.log(`${icon} ${label}${suffix}`);
}

async function main() {
  console.log("Checking database state against migrations 0010-0014...\n");

  const missing = new Set();

  const iterCol = await columnExists("users", "pbkdf2_iterations");
  report("users.pbkdf2_iterations column", iterCol, "0010_pbkdf2_iterations.sql");
  if (!iterCol) missing.add("0010");

  const fnUpdated = await checkFunctionSignature();
  report("change_master_password() accepts iterations", fnUpdated, "0011_change_master_password_fn_iterations.sql");
  if (fnUpdated === false) missing.add("0011");

  const hintCol = await columnExists("passwords", "encrypted_hint");
  report("passwords.encrypted_hint column", hintCol, "0012_password_hint.sql");
  if (!hintCol) missing.add("0012");

  const hintSetting = await settingItemExists("hint_only_mode");
  report("setting_items: hint_only_mode", hintSetting, "0013_hint_only_mode_setting.sql");
  if (!hintSetting) missing.add("0013");

  const autoFillSetting = await settingItemExists("auto_fill_single_match");
  report("setting_items: auto_fill_single_match", autoFillSetting, "0014_auto_fill_single_match_setting.sql");
  if (!autoFillSetting) missing.add("0014");

  console.log();
  if (missing.size === 0) {
    console.log("All checked migrations are applied.");
  } else {
    console.log(`Missing migrations: ${[...missing].sort().join(", ")}`);
    console.log("Run those in the Supabase SQL editor, in order.");
    return;
  }

  // Schema is fine — check whether the features are actually *in use*,
  // which is the next most likely explanation if migrations aren't the
  // problem. Service role bypasses RLS, so this sees every user's data;
  // fine for a local diagnostic, never do this with the anon key.
  console.log("\nSchema is fully migrated — checking actual usage...\n");

  const { data: hintOnRows, error: hintOnErr } = await supabase
    .from("user_settings")
    .select("user_id, value")
    .eq("setting_key", "hint_only_mode");
  if (hintOnErr) throw new Error(`Checking hint_only_mode usage: ${hintOnErr.message}`);
  const hintOnCount = (hintOnRows ?? []).filter((r) => r.value === true).length;
  console.log(
    `hint_only_mode: ${hintOnRows?.length ?? 0} user(s) have a saved value, ${hintOnCount} have it ON`
  );

  const { data: autoFillRows, error: autoFillErr } = await supabase
    .from("user_settings")
    .select("user_id, value")
    .eq("setting_key", "auto_fill_single_match");
  if (autoFillErr) throw new Error(`Checking auto_fill_single_match usage: ${autoFillErr.message}`);
  const autoFillOnCount = (autoFillRows ?? []).filter((r) => r.value === true).length;
  console.log(
    `auto_fill_single_match: ${autoFillRows?.length ?? 0} user(s) have a saved value, ${autoFillOnCount} have it ON`
  );

  const { count: hintCount, error: hintCountErr } = await supabase
    .from("passwords")
    .select("id", { count: "exact", head: true })
    .not("encrypted_hint", "is", null)
    .eq("deleted", false);
  if (hintCountErr) throw new Error(`Checking saved hints: ${hintCountErr.message}`);
  console.log(`Entries with a hint actually saved: ${hintCount ?? 0}`);

  console.log();
  if (hintOnCount === 0) {
    console.log("hint_only_mode has never actually been turned on for any account.");
  } else if (hintCount === 0) {
    console.log(
      "hint_only_mode is on for at least one account, but no entry anywhere has a hint saved —" +
        " it can't show what doesn't exist. Set a hint on an entry's edit form first."
    );
  }
  if (autoFillOnCount === 0) {
    console.log("auto_fill_single_match has never actually been turned on for any account.");
  }
}

main().catch((err) => {
  console.error("\nCheck failed:", err.message);
  process.exit(1);
});
