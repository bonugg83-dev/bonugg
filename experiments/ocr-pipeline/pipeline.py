"""실험: 시험지 PDF -> 문제별 크롭 -> 필기 분리 -> 글자 단위 OCR (tesseract kor / rapidocr).
운영 아티팩트와 무관한 테스트용. 사용: python3 -I pipeline.py in.pdf out_dir"""
import sys, os, re, json
import pymupdf as fitz, numpy as np, cv2, pytesseract
from PIL import Image
Z = 3  # 렌더 배율

def render(page, clip=None):
    pm = page.get_pixmap(matrix=fitz.Matrix(Z, Z), clip=clip, alpha=False)
    return np.frombuffer(pm.samples, np.uint8).reshape(pm.h, pm.w, 3).copy()

def overlays(page):
    """페이지 크기 배경을 뺀 그림층(= 필기) bbox 목록"""
    out = []
    for im in page.get_images(True):
        r = page.get_image_bbox(im)
        if r.width > page.rect.width * .95 and r.height > page.rect.height * .95: continue
        out.append(r)
    return out

def split_text_layer(page):
    """글자 레이어가 있는 PDF: 줄 맨 앞 'N.' 으로 문제 경계, 2단 자동 분리"""
    W, H = page.rect.width, page.rect.height
    words = page.get_text("words")
    # 열 경계: 단어 x중심이 가운데 근처에 비어 있는 곳
    # 열 경계: 가운데 부근에서 단어가 가장 안 걸리는 x (2단 시험지)
    cover = np.zeros(int(W) + 2)
    for w in words:
        if H * .1 < w[1] < H * .95: cover[int(w[0]):int(w[2]) + 1] += 1
    lo, hi = int(W * .35), int(W * .65)
    gap = lo + int(np.argmin(cover[lo:hi]))
    two = cover[gap] == 0 and sum(1 for w in words if w[0] > gap) > 20 and sum(1 for w in words if w[2] < gap) > 20
    mid = gap
    cols = [(0, mid), (mid, W)] if two else [(0, W)]
    starts = []
    for ci, (cx0, cx1) in enumerate(cols):
        cw = [w for w in words if cx0 <= w[0] < cx1 and w[1] > H * .1]
        if not cw: continue
        left = min(w[0] for w in cw)
        for w in cw:
            m = re.fullmatch(r"(\d{1,2})\.", w[4])
            if m and w[0] < left + 20:
                starts.append((ci, w[1] - 2, int(m.group(1)), cx0, cx1))
    starts.sort(key=lambda s: (s[0], s[1]))
    boxes = []
    for i, (ci, y, n, cx0, cx1) in enumerate(starts):
        nxt = [s[1] for s in starts[i + 1:] if s[0] == ci]
        ybot = nxt[0] - 2 if nxt else max(w[3] for w in words if cx0 <= w[0] < cx1) + 6
        boxes.append(dict(no=n, rect=fitz.Rect(cx0 + 8, y, cx1 - 8, ybot)))
    return boxes

def split_scan(page):
    """스캔본: 배경 이미지 잉크 가로 투영으로 번호 후보 줄 찾기(큼+내어쓰기+혼자). 약한 휴리스틱"""
    W, H = page.rect.width, page.rect.height
    img = render(page); g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    ink = ((g < 140) | ((hsv[..., 1] > 110) & (hsv[..., 2] > 90))).astype(np.uint8)
    ih, iw = ink.shape
    ink[:int(ih * .10)] = 0; ink[int(ih * .93):] = 0; ink[:, int(iw * .92):] = 0
    rows = ink.sum(1) > 0
    lines, s = [], None
    for y, v in enumerate(rows):
        if v and s is None: s = y
        if not v and s is not None:
            if y - s >= 5 * Z / 2: lines.append((s, y))
            s = None
    info = []
    for a, b in lines:
        xs = np.where(ink[a:b].sum(0) > 0)[0]
        info.append((a, b, xs.min(), xs.max()))
    if not info: return []
    med = np.median([b - a for a, b, *_ in info]); bodyleft = np.median([l for *_, l, r in info])
    cand = []
    for k, (a, b, l, r) in enumerate(info):
        score = 0
        if b - a >= med * 1.25: score += 1
        if l < bodyleft - 8: score += 1
        seg = hsv[a:b, l:r + 1]; sm = ink[a:b, l:r + 1] > 0
        orange = ((seg[..., 0] >= 8) & (seg[..., 0] <= 28) & (seg[..., 1] > 110))[sm].mean() if sm.any() else 0
        if orange > .5: score += 2                                # 주황 번호(교재 번호 디자인)
        if (r - l) < iw * .12: score += 1                      # 혼자 있는 짧은 줄
        gap = a - info[k - 1][1] if k else 99
        if gap > med * 1.2: score += 1
        if score >= 3 and (b - a) < med * 3: cand.append(a)
    boxes = []
    for i, a in enumerate(cand):
        bot = cand[i + 1] if i + 1 < len(cand) else int(ih * .93)
        boxes.append(dict(no=i + 1, rect=fitz.Rect(10, a / Z - 2, W - 10, bot / Z - 2)))
    return boxes

def owner(o, boxes):
    """필기 그림층 -> 같은 단에서 중심 y 위쪽으로 가장 가까운 문제 시작점의 문제(없으면 첫 문제)"""
    cx, cy = (o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2
    same = [b for b in boxes if b["rect"].x0 <= cx <= b["rect"].x1] or boxes
    above = [b for b in same if b["rect"].y0 <= cy]
    return max(above, key=lambda b: b["rect"].y0) if above else min(same, key=lambda b: b["rect"].y0)

def pen_masks(img_rgb):
    """빨강/파랑 잉크만 남긴 이진 마스크(검정 필기·인쇄 제외)"""
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = ((h < 8) | (h > 170)) & (s > 90) & (v > 80)
    blue = (h > 100) & (h < 130) & (s > 90) & (v > 60)
    return red, blue

def ocr_chars(mask, lang="kor"):
    """마스크(True=잉크) -> 흰 바탕 검정 글씨로 반전 후 tesseract 글자 단위 인식"""
    m = cv2.dilate(mask.astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
    im = 255 - m
    im = cv2.copyMakeBorder(im, 30, 30, 30, 30, cv2.BORDER_CONSTANT, value=255)
    cfg = "--psm 6"
    text = pytesseract.image_to_string(im, lang=lang, config=cfg).strip()
    H = im.shape[0]
    chars = [dict(c=l[0], box=[int(x) for x in l[1:5]], conf=None)
             for l in (ln.split(" ") for ln in pytesseract.image_to_boxes(im, lang=lang, config=cfg).splitlines())]
    d = pytesseract.image_to_data(im, lang=lang, config=cfg, output_type=pytesseract.Output.DICT)
    confs = [float(c) for c, t in zip(d["conf"], d["text"]) if t.strip() and float(c) >= 0]
    return text, chars, (sum(confs) / len(confs) if confs else 0), im

def main(pdf, out):
    os.makedirs(out, exist_ok=True)
    doc = fitz.open(pdf); res = []
    for pi, page in enumerate(doc):
        has_text = len(page.get_text("words")) > 10
        boxes = split_text_layer(page) if has_text else split_scan(page)
        ovs = overlays(page)
        mode = "글자레이어" if has_text else "스캔(잉크 분석)"
        if not boxes: boxes = [dict(no=1, rect=page.rect)]; mode += "+경계실패→전체"
        for b in boxes:
            r = b["rect"]
            # 이 문제에 속한 필기 그림층: 중심이 문제 박스 안(첫 문제 위쪽이면 첫 문제)
            mine = [o for o in ovs if owner(o, boxes) is b]
            full = fitz.Rect(r)
            for o in mine: full |= o
            full &= page.rect
            tag = f"p{pi+1}-q{b['no']}"
            crop = render(page, full)
            Image.fromarray(crop).save(f"{out}/{tag}.png")
            item = dict(tag=tag, no=b["no"], mode=mode, rect=[round(v, 1) for v in full], has_overlay=bool(mine))
            if has_text:
                item["printed_text_layer"] = page.get_text("text", clip=r).strip()
            if mine:
                # 필기 영역만 따로 렌더(그림층 bbox)
                ob = mine[0]
                for o in mine[1:]: ob |= o
                pen = render(page, ob)
                red, blue = pen_masks(pen)
                for name, mk in (("red", red), ("blue", blue)):
                    item[f"{name}_px"] = int(mk.sum())
                    if mk.sum() < 200: continue
                    text, chars, conf, im = ocr_chars(mk)
                    Image.fromarray(im).save(f"{out}/{tag}-{name}-ink.png")
                    item[f"hand_{name}"] = dict(text=text, n_chars=len([c for c in chars if c['c'].strip()]), mean_conf=round(conf, 1), chars=chars[:200])
            res.append(item)
    json.dump(res, open(f"{out}/result.json", "w"), ensure_ascii=False, indent=1)
    return res

if __name__ == "__main__":
    for r in main(sys.argv[1], sys.argv[2]):
        print(r["tag"], r["mode"], r["rect"], "overlay" if r["has_overlay"] else "", {k: (v["text"] if isinstance(v, dict) else v) for k, v in r.items() if k.startswith(("hand_", "red_px", "blue_px"))})
