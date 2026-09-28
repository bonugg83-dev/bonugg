import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface ConceptRow {
  id: string;
  text: string;
  subject_id: string;
  crop_image_path: string;
  created_at: string;
  next_review_date?: string;
  ease_factor?: number;
  interval_days?: number;
}

export async function withSignedImageUrl(supabase: SupabaseClient, row: ConceptRow) {
  const { data: signed } = await supabase.storage
    .from("concept-crops")
    .createSignedUrl(row.crop_image_path, SIGNED_URL_TTL_SECONDS);
  return {
    id: row.id,
    text: row.text,
    subjectId: row.subject_id,
    createdAt: row.created_at,
    imageUrl: signed?.signedUrl ?? null,
  };
}
