import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();

  const { data: row } = await supabase
    .from("concepts")
    .select("crop_image_path")
    .eq("id", params.id)
    .single();

  if (row) {
    await supabase.storage.from("concept-crops").remove([row.crop_image_path]);
  }

  const { error } = await supabase.from("concepts").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
