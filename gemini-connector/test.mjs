import worker from './worker.js';
const env = { GEMINI_API_KEY: 'k', PATH_TOKEN: 'tok' };
let seen = null;
globalThis.fetch = async (url, init) => {
  seen = { url, headers: init.headers, body: JSON.parse(init.body) };
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[{"coloredInk":true,"text":"ok"}]' }] } }] }), { status: 200 });
};
const post = (path, body) => worker.fetch(new Request('https://w.dev' + path, { method: 'POST', body: JSON.stringify(body) }), env);
const ok = async (label, cond) => { console.log(cond ? 'PASS' : 'FAIL', label); if (!cond) process.exitCode = 1; };

let r = await post('/mcp/wrong', {});          ok('wrong token 404', r.status === 404);
r = await post('/mcp/tok', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
ok('initialize', (await r.json()).result.protocolVersion === '2025-06-18');
r = await post('/mcp/tok', { jsonrpc: '2.0', method: 'notifications/initialized' }); ok('notification 202', r.status === 202);
r = await post('/mcp/tok', { jsonrpc: '2.0', id: 2, method: 'tools/list' });
ok('tools/list', (await r.json()).result.tools[0].name === 'gemini_vision');
r = await post('/mcp/tok', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'gemini_vision', arguments: { prompt: 'p', images: ['AAAA', 'data:image/jpeg;base64,BBBB'] } } });
const j = await r.json();
ok('call ok text', j.result.content[0].text.includes('coloredInk') && !j.result.isError);
ok('gemini request shape', seen.url.includes('gemini-3.1-flash-lite:generateContent') && seen.headers['x-goog-api-key'] === 'k'
  && seen.body.contents[0].parts.filter(p => p.inline_data).length === 2 && seen.body.contents[0].parts.at(-1).inline_data.data === 'BBBB'
  && seen.body.generationConfig.responseMimeType === 'application/json');
r = await post('/mcp/tok', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'gemini_vision', arguments: { prompt: 'p', images: [] } } });
ok('empty images flagged', (await r.json()).result.isError === true);
globalThis.fetch = async () => new Response('{"error":"bad"}', { status: 400 });
r = await post('/mcp/tok', { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'gemini_vision', arguments: { prompt: 'p', images: ['A'] } } });
const e = await r.json(); ok('gemini 400 surfaced', e.result.isError && e.result.content[0].text.includes('400'));
r = await worker.fetch(new Request('https://w.dev/mcp/tok'), env); ok('GET 405', r.status === 405);
