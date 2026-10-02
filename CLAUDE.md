# 개념노트 — PDF/스크린샷 → 개념 카드 등록 파이프라인

## 절대 규칙: 수정 대상은 이 앱 하나뿐

이 프로젝트의 모든 작업(기능 추가, 버그 수정, 디자인 변경)은 **아티팩트
https://claude.ai/artifact/Q1WjeTNkPEwkD8XmmqbQti** 한 곳에만 한다.

- 앱 수정: 먼저 `Artifact read`로 최신 버전을 읽고, 같은 `url`로 republish해서 새 버전으로 반영한다. 새 아티팩트를 만들거나 다른 앱을 만들지 않는다.
- `artifact/index.html`은 이 아티팩트의 백업 사본이다(2026-10-02 기준). 아티팩트를 고칠 때마다 이 파일도 같은 내용으로 갱신해서 커밋한다. 둘이 다르면 아티팩트가 정답이다.
- 아래 `app/`, `lib/`, `supabase/` 등 Next.js 코드는 폐기된 버전이다. 수정하거나 되살리지 않는다.

## 현재 상태

실제로 쓰는 앱은 이 저장소의 코드가 아니라 **클로드 아티팩트**입니다:

**https://claude.ai/artifact/Q1WjeTNkPEwkD8XmmqbQti**

(이 저장소 안의 Next.js 코드는 초기에 시도했다가 포기한 버전입니다. 아티팩트의
`sample`(AI 비전) capability가 이 계정에서 이미지 입력을 지원하지 않아서, 손글씨
인식/문제 경계 인식을 아티팩트 자체 AI로는 할 수 없습니다. 그래서 그 처리를
Claude Code 세션이 직접 수행해서 아티팩트의 DB/자산 저장소에 써주는 방식으로
우회합니다. 이 파일이 그 절차입니다.)

## 사용자가 PDF나 스크린샷을 올리며 "개념 추가해줘"라고 하면

1. 과목(subjectId)을 모르면 물어봐서 확인: `intermediate`(중급회계) /
   `advanced`(고급회계) / `tax`(세무회계) / `finance`(재무관리) /
   `economics`(경제학) / `cost`(원가관리회계) 중 하나.

2. PDF면 페이지별 이미지로 렌더링. `python3 -c "import fitz"`가 실패하면 먼저
   `pip install pymupdf`.
   ```python
   import fitz
   doc = fitz.open("<업로드된 pdf 경로>")
   for i, page in enumerate(doc):
       pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
       pix.save(f"/tmp/page-{i}.png")
   ```
   이미 낱장 스크린샷이면 이 단계는 건너뛰고 바로 5번으로.

3. 각 페이지 이미지를 Read 도구로 직접 보고, 인쇄된 문제 번호(굵은 글씨)를
   기준으로 각 문제의 영역을 페이지 비율(0~1, 문제 번호 시작 지점부터 다음
   문제 번호 직전 또는 페이지 끝까지)로 판단.

4. 판단한 비율 좌표를 페이지 실제 크기(`page.rect.width/height`, 렌더링에 쓴
   matrix 배율만큼 곱하기)로 환산해서 문제별로 크롭:
   ```python
   clip = fitz.Rect(x0, y0, x1, y1)  # 포인트 좌표
   pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip)
   pix.save(f"/tmp/crop-{n}.png")
   ```

5. 각 크롭(또는 스크린샷) 이미지를 Read 도구로 직접 보고:
   - **검정 잉크**(문제 풀이 과정, 채점 표시, 계산)는 완전히 무시.
   - **빨간색 또는 파란색 잉크**로 쓴 손글씨만 읽기 — 이게 사용자가 이 문제를
     통해 새로 얻은 개념/통찰.
   - 약어·축약 표현은 회계·재무·세무·경제 지식으로 정확한 용어로 풀어써서
     매끄러운 문장으로 다듬기. 사용자가 쓰지 않은 새 주장·해석 추가 금지,
     의미 왜곡 금지.
   - 빨강/파랑 잉크가 전혀 없으면 그 문제는 건너뛰기(개념 없음 — 저장 안 함).

6. 남은 각 이미지를 아티팩트 자산으로 업로드:
   ```
   Artifact({
     action: "publish",
     url: "https://claude.ai/artifact/Q1WjeTNkPEwkD8XmmqbQti",
     file_path: "<크롭 이미지 경로>",
     asset: true
   })
   ```
   결과가 `imageId`로 쓸 `id`를 직접 알려준다 (= `/_blob/` 뒤에 오는 부분과 동일).

7. `concepts` 컬렉션에 문서 추가. 여러 개면 `ArtifactData`의 `batch`로 한 번에
   (최대 50개씩, `doc_id`는 직접 생성 — 예: `concept-<타임스탬프>-<n>`):
   ```
   ArtifactData({
     action: "batch",
     url: "https://claude.ai/artifact/Q1WjeTNkPEwkD8XmmqbQti",
     writes: [
       {
         op: "set",
         collection: "concepts",
         doc_id: "concept-...",
         data: {
           text: "<다듬은 텍스트, 없으면 빈 문자열>",
           subjectId: "<과목 id>",
           imageId: "<6번에서 추출한 id>",
           easeFactor: 2.5,
           intervalDays: 1,
           nextReviewDate: "<지금 시각, ISO 문자열>",
           createdAt: "<지금 시각, ISO 문자열>",
           lastReviewedAt: null
         }
       }
     ]
   })
   ```

8. 몇 개를 추가했는지(그리고 몇 개는 빨강/파랑 잉크가 없어서 건너뛰었는지)
   사용자에게 알려주기.

## 데이터 모델 참고

`concepts` 컬렉션 문서 하나 = 개념 하나:
- `text`: 다듬어진 개념 텍스트 (빈 문자열 가능)
- `subjectId`: 위 5개 중 하나
- `imageId`: 자산 id — 아티팩트 페이지는 `/_blob/` + imageId 로 표시
- `easeFactor`, `intervalDays`, `nextReviewDate`: SM-2 기반 안키식 복습 스케줄
  (180일 최대 간격, 졸업 없음 — 페이지 JS의 `applySrs` 참고)
- `createdAt`, `lastReviewedAt`

새로 만든 개념은 항상 `nextReviewDate`를 지금 시각으로 넣어서, 그날 밤 복습 큐에
바로 뜨게 한다.
