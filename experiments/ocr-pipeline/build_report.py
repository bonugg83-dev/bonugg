"""results/*/result.json + 이미지 -> results/report.html (이미지 base64 내장, 단일 파일)"""
import json, base64, html, glob, os
def b64(p): return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
NOTE = {
 "Red": "디지털 시험지(글자 레이어 있음). 문제 2개 정확히 분리, 빨강 메모는 문제 1에 붙음.",
 "Kim": "책 스캔. 주황 번호 '09','10' 규칙으로 2문제 분리(09는 메모 없음, 10에 메모). 검정 O/X·그래프는 제외, 빨강만 분리.",
 "Hh": "책 스캔. 번호 '01'의 연한 하늘색 때문에 경계 찾기 실패 → 페이지 전체를 1개로 처리(알려진 한계). 메모는 낙서에 가까움.",
}
h = ["<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>OCR 파이프라인 실험 결과</title>",
 "<style>body{font:15px/1.5 system-ui,sans-serif;max-width:980px;margin:0 auto;padding:16px;background:#fafafa;color:#222}img{max-width:100%;border:1px solid #ccc;background:#fff}.card{background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px;margin:12px 0}pre{background:#f1f1f1;padding:8px;overflow:auto;white-space:pre-wrap}.g{display:flex;gap:12px;flex-wrap:wrap}.g>div{flex:1 1 300px}h2{margin-top:32px}</style>",
 "<h1>OCR 파이프라인 실험 (테스트용, 운영 아티팩트와 무관)</h1>",
 "<p>PDF → 문제별 크롭 → 필기(빨강/파랑)만 분리 → 글자 단위 OCR. 도구: PyMuPDF, OpenCV, tesseract 5.3 + kor 모델. 이 샌드박스는 PyPI/apt만 열려 있어 PaddleOCR·EasyOCR 한국어 모델은 내려받지 못했다.</p>",
 "<div class=card><b>정량 결과</b><pre>"+html.escape(open("results/handwriting-eval.txt").read())+"\n[인쇄 활자: Red 크롭을 tesseract로 읽고 PDF 글자 레이어(정답)와 비교]\n"+html.escape(open("results/printed-eval.txt").read())+"</pre></div>"]
for n in ("Red", "Kim", "Hh"):
    R = json.load(open(f"results/{n}/result.json"))
    h.append(f"<h2>{n}.pdf</h2><p>{NOTE[n]}</p>")
    for it in R:
        h.append(f"<div class=card><b>{it['tag']}</b> · {it['mode']} · 영역 {it['rect']} · 빨강 {it.get('red_px',0)}px / 파랑 {it.get('blue_px',0)}px<div class=g><div><div>문제 크롭</div><img src='{b64(f'results/{n}/'+it['tag']+'.png')}'></div>")
        for c in ("red", "blue"):
            p = f"results/{n}/{it['tag']}-{c}-ink.png"
            if f"hand_{c}" in it:
                d = it[f"hand_{c}"]
                chars = " ".join(x["c"] for x in d["chars"] if x["c"].strip())
                h.append(f"<div><div>{c} 잉크만 분리</div><img src='{b64(p)}'><pre>줄 단위: {html.escape(d['text'])}\n글자 단위({d['n_chars']}자, 평균 신뢰도 {d['mean_conf']}): {html.escape(chars)}</pre></div>")
        h.append("</div></div>")
open("results/report.html", "w").write("".join(h))
