import { NextRequest, NextResponse } from "next/server";
import { askVisionJson, blobToImageInput } from "@/lib/claude";

const PROMPT = `너는 CPA 시험(회계·재무·세무·경제) 도메인 지식이 있는 조교다. 이 이미지는 문제를 손으로 푼 크롭 이미지다.

- 검정색 잉크(문제 풀이 과정, 채점 표시, 계산)는 완전히 무시해라.
- 빨간색 또는 파란색 잉크로 쓰인 손글씨만 읽어라. 이게 사용자가 이 문제를 통해 새로 얻은 개념/통찰이다.
- 약어나 축약된 표현은 정확한 회계·재무·세무·경제 용어로 풀어써서 매끄러운 문장으로 다듬어라.
- 사용자가 쓰지 않은 새로운 주장이나 해석을 추가하지 마라. 의미를 왜곡하지 마라.
- 빨강/파랑 잉크가 전혀 없으면 text를 빈 문자열로 해라.

JSON 객체 {"text": "..."} 형태로만 반환해라. 설명 없이 JSON만 반환.`;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  try {
    const imageInput = await blobToImageInput(image);
    const result = await askVisionJson<{ text?: string }>(PROMPT, [imageInput]);
    return NextResponse.json({ text: result.text ?? "" });
  } catch (e) {
    return NextResponse.json({ error: "transcription failed" }, { status: 500 });
  }
}
