import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { withSignedImageUrl } from "@/lib/concepts";
import { DAILY_REVIEW_CAP } from "@/lib/srs";

export async function GET() {
  const supabase = supabaseServer();

  // Most-overdue-first: whatever has been waiting longest gets seen first.
  // New concepts default to next_review_date = created_at, so they're
  // naturally included here without a separate "new today" query.
  const { data, error } = await supabase
    .from("concepts")
    .select("id, text, subject_id, crop_image_path, created_at")
    .lte("next_review_date", new Date().toISOString())
    .order("next_review_date", { ascending: true })
    .limit(DAILY_REVIEW_CAP);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = await Promise.all((data ?? []).map((row) => withSignedImageUrl(supabase, row)));
  return NextResponse.json({ queue });
}
