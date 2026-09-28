import { NextRequest, NextResponse } from "next/server";
import { askVisionJson, blobToImageInput } from "@/lib/claude";
import type { NormalizedBounds } from "@/lib/pdf";

const PROMPT = `다음은 CPA 시험 문제지의 한 페이지 이미지다. 이 페이지 안에서 인쇄된 문제 번호(굵은 글씨, 예: 10, 11)를 앵커로 삼아 각 문제의 영역을 찾아라.

규칙:
- 각 문제의 영역은 그 문제 번호가 시작하는 지점부터, 다음 문제 번호 바로 앞(또는 페이지 끝)까지다.
- 인쇄된 테두리/칸은 보통 없다. 손글씨(풀이, 개념 메모)가 어디까지 이어지는지 추측하지 말고, 문제 번호 위치만 기준으로 삼아라.
- 이 페이지에 완결된 문제가 없으면 빈 배열을 반환해라.

각 영역을 페이지 크기에 대한 비율 좌표(0~1)로, JSON 배열로 반환해라. 형식: [{"x":0.0,"y":0.0,"width":1.0,"height":0.3}, ...]
설명 없이 JSON 배열만 반환해.`;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  try {
    const imageInput = await blobToImageInput(image);
    const boxes = await askVisionJson<NormalizedBounds[]>(PROMPT, [imageInput]);
    return NextResponse.json({ boxes: Array.isArray(boxes) ? boxes : [] });
  } catch (e) {
    return NextResponse.json({ error: "boundary detection failed" }, { status: 500 });
  }
}
