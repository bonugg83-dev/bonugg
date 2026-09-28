import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Can be swapped for a cheaper model (e.g. "claude-sonnet-5") if per-call cost
// on high volumes of image calls matters more than accuracy.
export const MODEL_ID = "claude-opus-5";

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface ImageInput {
  mediaType: SupportedMediaType;
  base64: string;
}

export async function blobToImageInput(blob: Blob): Promise<ImageInput> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return {
    mediaType: (blob.type as SupportedMediaType) || "image/jpeg",
    base64: buf.toString("base64"),
  };
}

// Sends one or more images plus a prompt that asks for a bare JSON response,
// and parses the first JSON value found in the reply.
export async function askVisionJson<T>(prompt: string, images: ImageInput[]): Promise<T> {
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img): Anthropic.ImageBlockParam => ({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType,
              data: img.base64,
            },
          })),
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const text = textBlock?.text ?? "";
  const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) throw new Error(`no JSON found in Claude response: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as T;
}
