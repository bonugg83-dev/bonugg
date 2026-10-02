// 개념노트 Gemini 커넥터 — Cloudflare Worker 한 파일 (외부 패키지 없음)
//
// claude.ai 에 "커스텀 커넥터"로 등록해서 개념노트 앱이 Gemini 비전을 부를 수 있게 해주는
// 아주 작은 원격 MCP 서버다. 도구는 gemini_vision 하나뿐이고, 앱이 보낸 프롬프트와
// 이미지(base64)를 Gemini 에 그대로 전달한 뒤 답 텍스트를 돌려준다.
//
// Worker 설정(대시보드 → Settings → Variables and Secrets):
//   GEMINI_API_KEY  (Secret, 필수)  Google AI Studio 에서 받은 키
//   PATH_TOKEN      (Secret, 필수)  아무도 못 맞출 긴 임의 문자열. 커넥터 주소의 일부가 된다
//   GEMINI_MODEL    (Text, 선택)    기본값 gemini-3.1-flash-lite
//
// 커넥터 주소: https://<worker 주소>/mcp/<PATH_TOKEN>

const TOOL = {
  name: 'gemini_vision',
  description: '이미지(base64 JPEG/PNG)와 지시문을 Gemini 에 보내고 답을 JSON 텍스트로 돌려준다.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Gemini 에게 줄 지시문 (출력 형식 포함)' },
      images: { type: 'array', items: { type: 'string' }, description: 'base64 로 인코딩한 이미지들 (data: 접두사 없이)' },
      mimeType: { type: 'string', description: '이미지 형식, 기본 image/jpeg' },
    },
    required: ['prompt', 'images'],
  },
  annotations: { readOnlyHint: true },
};

const MAX_IMAGES = 12;
const MAX_BASE64_CHARS = 4_000_000;

function rpc(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
function toolText(text, isError) {
  return { content: [{ type: 'text', text: text }], isError: !!isError };
}

export async function callGemini(args, env, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const prompt = args && args.prompt;
  const images = args && args.images;
  if (typeof prompt !== 'string' || !prompt.trim()) return toolText('prompt 가 비어 있어요.', true);
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    return toolText('images 는 1~' + MAX_IMAGES + '개여야 해요.', true);
  }
  let total = 0;
  for (const im of images) {
    if (typeof im !== 'string') return toolText('images 는 base64 문자열 배열이어야 해요.', true);
    total += im.length;
  }
  if (total > MAX_BASE64_CHARS) return toolText('이미지 전체 용량이 너무 커요.', true);

  const mime = typeof args.mimeType === 'string' && /^image\//.test(args.mimeType) ? args.mimeType : 'image/jpeg';
  const parts = [{ text: prompt }];
  images.forEach(function (b64, i) {
    if (images.length > 1) parts.push({ text: '이미지 ' + (i + 1) + ':' });
    parts.push({ inline_data: { mime_type: mime, data: b64.replace(/^data:[^,]*,/, '') } });
  });

  const model = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  let res;
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
  } catch (e) {
    return toolText('Gemini 에 연결하지 못했어요: ' + (e && e.message), true);
  }
  const raw = await res.text();
  if (!res.ok) return toolText('Gemini 오류 ' + res.status + ': ' + raw.slice(0, 500), true);
  let data;
  try { data = JSON.parse(raw); } catch (e) { return toolText('Gemini 응답을 읽지 못했어요.', true); }
  const cand = data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts
    ? cand.content.parts.map(function (p) { return p.text || ''; }).join('')
    : '';
  if (!text) {
    const why = (data.promptFeedback && data.promptFeedback.blockReason) || (cand && cand.finishReason) || '빈 응답';
    return toolText('Gemini 가 답을 주지 않았어요 (' + why + ').', true);
  }
  return toolText(text, false);
}

async function handleRpc(msg, env, fetchImpl) {
  const id = msg.id;
  switch (msg.method) {
    case 'initialize':
      return rpc(id, {
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'gaenyeom-gemini', version: '1.0.0' },
      });
    case 'ping':
      return rpc(id, {});
    case 'tools/list':
      return rpc(id, { tools: [TOOL] });
    case 'tools/call': {
      if (!msg.params || msg.params.name !== TOOL.name) return rpcError(id, -32602, '알 수 없는 도구예요.');
      return rpc(id, await callGemini(msg.params.arguments, env, fetchImpl));
    }
    default:
      return rpcError(id, -32601, '지원하지 않는 메서드예요: ' + msg.method);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.PATH_TOKEN || !env.GEMINI_API_KEY) return new Response('Worker 변수(GEMINI_API_KEY, PATH_TOKEN)가 설정되지 않았어요.', { status: 500 });
    if (url.pathname !== '/mcp/' + env.PATH_TOKEN) return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    let body;
    try { body = await request.json(); } catch (e) { return json(rpcError(null, -32700, 'JSON 이 아니에요.'), 400); }

    if (Array.isArray(body)) {
      const out = [];
      for (const m of body) { if (m && m.id !== undefined) out.push(await handleRpc(m, env)); }
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    if (body.id === undefined) return new Response(null, { status: 202 }); // notifications/*
    return json(await handleRpc(body, env));
  },
};
