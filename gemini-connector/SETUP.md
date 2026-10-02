# Gemini 커넥터 설정 (한 번만 하면 됨)

개념노트 앱의 "AI 자동 추출"이 Gemini 로 동작하게 하는 작은 서버(`worker.js`)를 Cloudflare 에 올리고,
claude.ai 에 커넥터로 등록하는 방법. 컴퓨터 브라우저에서 하는 걸 권장.

## 1. Gemini API 키
1. https://aistudio.google.com/apikey 에서 "Create API key"
2. 키를 복사해 둔다 (남에게 보여주지 말 것)

> 무료 등급은 입력 데이터가 구글 제품 개선에 쓰일 수 있다. 문제집 이미지가 신경 쓰이면 결제 정보를 연결한 유료 등급을 쓰면 된다 (페이지당 약 1.5원 추정).

## 2. Cloudflare Worker 만들기
1. https://dash.cloudflare.com 가입/로그인 → 왼쪽 **Workers & Pages** → **Create** → **Create Worker** → 이름 `gaenyeom-gemini` → **Deploy**
2. **Edit code** → 기본 코드를 모두 지우고 이 폴더의 `worker.js` 내용을 통째로 붙여넣기 → **Deploy**
3. Worker 화면 → **Settings** → **Variables and Secrets** → 추가
   - `GEMINI_API_KEY` : 1번에서 받은 키 (Type: Secret)
   - `PATH_TOKEN` : 길고 아무도 못 맞출 문자열, 영문/숫자 30자 이상 (Type: Secret)
   - (선택) `GEMINI_MODEL` : 기본값은 `gemini-3.1-flash-lite`. 더 정확한 걸 원하면 `gemini-3.7-flash` (Type: Text)
4. 저장 후 Worker 주소(`https://gaenyeom-gemini.<계정>.workers.dev`)를 확인

## 3. claude.ai 에 커넥터 등록
1. claude.ai → Settings(설정) → **Connectors** → **Add custom connector**
2. **이름은 정확히 `개념노트 Gemini`** (앱이 이 이름으로 찾는다)
3. URL: `https://gaenyeom-gemini.<계정>.workers.dev/mcp/<PATH_TOKEN 값>`
4. 추가 (인증 정보는 비워 둔다)

## 4. 확인
개념노트 앱 → 업로드 탭 → **AI PDF 자동 추출** → 처음 한 번 허용 창이 뜨면 허용.

주소의 `PATH_TOKEN` 이 비밀번호 역할이다. 유출되면 Worker 의 `PATH_TOKEN` 만 바꾸고 커넥터 주소를 다시 등록하면 된다.
