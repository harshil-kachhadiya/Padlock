import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAuthedClient(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  const { siteName, siteUrl, username, encryptedPassword, encryptedTotpSecret, tags } =
    await request.json();

  if (!siteName || !siteUrl || !encryptedPassword) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getAuthedClient(authHeader);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .insert({
      user_id: user.id,
      site_name: siteName,
      site_url: siteUrl,
      username: username || null,
      encrypted_totp_secret: encryptedTotpSecret || null,
      tags: Array.isArray(tags) ? tags : [],
    })
    .select("id")
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: siteError?.message ?? "Failed to create site" }, { status: 400 });
  }

  const { error: passwordError } = await supabase.from("passwords").insert({
    site_id: site.id,
    user_id: user.id,
    encrypted_password: encryptedPassword,
  });

  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, siteId: site.id });
}
