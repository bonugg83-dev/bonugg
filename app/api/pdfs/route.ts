import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const fileName = form.get("fileName");
  const pageCount = form.get("pageCount");
  if (!(file instanceof Blob) || typeof fileName !== "string") {
    return NextResponse.json({ error: "file and fileName required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const storagePath = `${randomUUID()}-${fileName}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("source-pdfs")
    .upload(storagePath, buf, { contentType: "application/pdf" });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("source_pdfs")
    .insert({
      file_name: fileName,
      storage_path: storagePath,
      page_count: pageCount ? Number(pageCount) : null,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
