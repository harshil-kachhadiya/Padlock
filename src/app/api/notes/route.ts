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

  const { title, encryptedContent } = await request.json();

  if (!title || !encryptedContent) {
    return NextResponse.json({ error: "Missing title or content" }, { status: 400 });
  }

  const supabase = getAuthedClient(authHeader);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: note, error: insertError } = await supabase
    .from("secure_notes")
    .insert({
      user_id: user.id,
      title,
      encrypted_content: encryptedContent,
    })
    .select("id")
    .single();

  if (insertError || !note) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create note" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, noteId: note.id });
}
