import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { applyReview, addDays, type Rating } from "@/lib/srs";

const VALID_RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { rating } = await req.json();
  if (!VALID_RATINGS.includes(rating)) {
    return NextResponse.json({ error: "invalid rating" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: row, error: fetchError } = await supabase
    .from("concepts")
    .select("ease_factor, interval_days")
    .eq("id", params.id)
    .single();
  if (fetchError || !row) {
    return NextResponse.json({ error: "concept not found" }, { status: 404 });
  }

  const next = applyReview(
    { easeFactor: row.ease_factor, intervalDays: row.interval_days },
    rating as Rating
  );
  const nextReviewDate = addDays(new Date(), next.intervalDays);

  const { error: updateError } = await supabase
    .from("concepts")
    .update({
      ease_factor: next.easeFactor,
      interval_days: next.intervalDays,
      next_review_date: nextReviewDate.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nextReviewDate: nextReviewDate.toISOString() });
}
