import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  const { salt, verifier, pbkdf2Iterations, updates } = await request.json();

  if (!salt || !verifier || !pbkdf2Iterations || !Array.isArray(updates)) {
    return NextResponse.json(
      { error: "Missing salt, verifier, pbkdf2Iterations, or updates" },
      { status: 400 }
    );
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

  const { error: rpcError } = await supabase.rpc("change_master_password", {
    p_salt: salt,
    p_verifier: verifier,
    p_pbkdf2_iterations: pbkdf2Iterations,
    p_updates: updates,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
