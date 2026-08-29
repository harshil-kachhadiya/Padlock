import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAuthedClient(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function requireUser(authHeader: string | null) {
  if (!authHeader) return null;

  const supabase = getAuthedClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return { supabase, user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const authed = await requireUser(request.headers.get("authorization"));

  if (!authed) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { supabase, user } = authed;
  const body = await request.json();
  const { siteName, siteUrl, username, encryptedPassword } = body;

  const siteUpdate: Record<string, unknown> = {
    site_name: siteName,
    site_url: siteUrl,
    username: username || null,
  };
  // Only touch the TOTP secret when the client explicitly sent the field —
  // `null` clears it, an object updates it, and omitting it leaves it as-is.
  if ("encryptedTotpSecret" in body) {
    siteUpdate.encrypted_totp_secret = body.encryptedTotpSecret;
  }

  const { error: siteUpdateError } = await supabase
    .from("sites")
    .update(siteUpdate)
    .eq("id", siteId)
    .eq("user_id", user.id);

  if (siteUpdateError) {
    return NextResponse.json({ error: siteUpdateError.message }, { status: 400 });
  }

  if (encryptedPassword) {
    const { data: activePassword, error: findError } = await supabase
      .from("passwords")
      .select("id")
      .eq("site_id", siteId)
      .eq("user_id", user.id)
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 400 });
    }

    if (activePassword) {
      const { error: passwordUpdateError } = await supabase
        .from("passwords")
        .update({ encrypted_password: encryptedPassword, updated_at: new Date().toISOString() })
        .eq("id", activePassword.id);

      if (passwordUpdateError) {
        return NextResponse.json({ error: passwordUpdateError.message }, { status: 400 });
      }
    } else {
      const { error: passwordInsertError } = await supabase.from("passwords").insert({
        site_id: siteId,
        user_id: user.id,
        encrypted_password: encryptedPassword,
      });

      if (passwordInsertError) {
        return NextResponse.json({ error: passwordInsertError.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const authed = await requireUser(request.headers.get("authorization"));

  if (!authed) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { supabase, user } = authed;

  const { error: siteDeleteError } = await supabase
    .from("sites")
    .update({ deleted: true })
    .eq("id", siteId)
    .eq("user_id", user.id);

  if (siteDeleteError) {
    return NextResponse.json({ error: siteDeleteError.message }, { status: 400 });
  }

  const { error: passwordDeleteError } = await supabase
    .from("passwords")
    .update({ deleted: true })
    .eq("site_id", siteId)
    .eq("user_id", user.id);

  if (passwordDeleteError) {
    return NextResponse.json({ error: passwordDeleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
