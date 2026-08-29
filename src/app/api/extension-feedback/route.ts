import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  const { reason, message } = await request.json();

  if (reason && typeof reason !== "string") {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  if (message && typeof message !== "string") {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  if ((reason?.length ?? 0) > 100 || (message?.length ?? 0) > 2000) {
    return NextResponse.json({ error: "Feedback too long" }, { status: 400 });
  }

  const { error } = await supabase.from("extension_feedback").insert({
    reason: reason || null,
    message: message || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
