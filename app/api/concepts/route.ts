import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { withSignedImageUrl } from "@/lib/concepts";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const image = form.get("image");
  const sourcePdfId = form.get("sourcePdfId");
  const pageNumber = form.get("pageNumber");
  const subjectId = form.get("subjectId");
  const boundsJson = form.get("bounds");
  const text = form.get("text");
  const rawText = form.get("rawText");

  if (
    !(image instanceof Blob) ||
    typeof pageNumber !== "string" ||
    typeof subjectId !== "string" ||
    typeof boundsJson !== "string" ||
    typeof text !== "string"
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const storagePath = `${randomUUID()}.jpg`;
  const buf = Buffer.from(await image.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("concept-crops")
    .upload(storagePath, buf, { contentType: "image/jpeg" });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("concepts")
    .insert({
      source_pdf_id: typeof sourcePdfId === "string" && sourcePdfId ? sourcePdfId : null,
      page_number: Number(pageNumber),
      subject_id: subjectId,
      crop_image_path: storagePath,
      crop_bounds: JSON.parse(boundsJson),
      raw_text: typeof rawText === "string" ? rawText : null,
      text,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const supabase = supabaseServer();

  let query = supabase
    .from("concepts")
    .select("id, text, subject_id, crop_image_path, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    query = query.ilike("text", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (data ?? []).map((row) => withSignedImageUrl(supabase, row))
  );

  return NextResponse.json({ concepts: withUrls });
}
