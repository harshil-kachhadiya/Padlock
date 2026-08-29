import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAuthedClient(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  const supabase = getAuthedClient(authHeader);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("setting_items")
    .select("key, default_value");

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  const { data: overrides, error: overridesError } = await supabase
    .from("user_settings")
    .select("setting_key, value")
    .eq("user_id", user.id);

  if (overridesError) {
    return NextResponse.json({ error: overridesError.message }, { status: 400 });
  }

  const overrideMap = new Map((overrides ?? []).map((row) => [row.setting_key, row.value]));

  const settings: Record<string, unknown> = {};
  for (const item of items ?? []) {
    settings[item.key] = overrideMap.has(item.key) ? overrideMap.get(item.key) : item.default_value;
  }

  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  const { key, value } = await request.json();

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  const supabase = getAuthedClient(authHeader);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error: upsertError } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, setting_key: key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,setting_key" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
