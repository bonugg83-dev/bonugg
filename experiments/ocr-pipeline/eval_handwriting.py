"""Red 샘플 빨강 메모 정답(사람이 눈으로 읽음)과 OCR 변형들의 글자 오류율 비교.
사용: python3 -I eval_handwriting.py <red-ink.png>"""
import sys, cv2, numpy as np, pytesseract
from rapidocr_onnxruntime import RapidOCR
GT = "재무정보는좋다오류가없다"
def lev(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[-1]
def norm(t): return "".join(t.split())
im = cv2.imread(sys.argv[1], 0)
pad = cv2.copyMakeBorder(im, 60, 60, 60, 60, cv2.BORDER_CONSTANT, value=255)
V = {}
for name, x in [("원본", im), ("0.5배", cv2.resize(im, None, fx=.5, fy=.5, interpolation=cv2.INTER_AREA)), ("두껍게", cv2.erode(im, np.ones((5, 5), np.uint8)))]:
    for psm in (6, 11): V[f"tesseract-kor {name} psm{psm}"] = pytesseract.image_to_string(x, lang="kor", config=f"--psm {psm}")
r, _ = RapidOCR()(pad); V["rapidocr(기본 중문모델)"] = "".join(t[1] for t in r) if r else ""
print(f"정답({len(GT)}자): {GT}")
rows = []
for k, t in V.items():
    t = norm(t); e = lev(t, GT); sm = sum(1 for c in set(GT) if c in t)
    rows.append((k, t, e, round(e / len(GT), 2), sm)); print(f"{k:32s} CER={e/len(GT):.2f} 정답글자포함={sm}/{len(set(GT))}  {t!r}")
