import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Delete app data across every table, all RLS-scoped to this user. This
  // removes the vault entirely; it does not remove the underlying Supabase
  // Auth identity record, which requires an admin (service-role) action.
  const tables = ["passwords", "secure_notes", "user_settings"] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: `Failed to delete ${table}: ${error.message}` }, { status: 400 });
    }
  }

  const { error: sitesError } = await supabase.from("sites").delete().eq("user_id", user.id);
  if (sitesError) {
    return NextResponse.json({ error: sitesError.message }, { status: 400 });
  }

  const { error: userRowError } = await supabase.from("users").delete().eq("id", user.id);
  if (userRowError) {
    return NextResponse.json({ error: userRowError.message }, { status: 400 });
  }

  // Removing the Supabase Auth identity itself requires the service-role key
  // (never exposed to the client — read from a server-only env var). If it
  // isn't configured, the app data above is still fully deleted; only the
  // auth record would remain, and re-signing-in would create a fresh vault.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (adminDeleteError) {
      return NextResponse.json(
        {
          ok: true,
          warning: `Vault data deleted, but removing the account identity failed: ${adminDeleteError.message}`,
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
