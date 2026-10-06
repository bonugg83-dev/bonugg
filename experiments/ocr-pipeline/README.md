# OCR 파이프라인 실험 (테스트용)

운영 앱(아티팩트)·`artifact/index.html`과 무관한 별도 실험. 시험지 PDF → 문제별 크롭 → 빨강/파랑 필기 분리 → 글자 단위 OCR.

```
pip install pymupdf opencv-python-headless pillow numpy pytesseract rapidocr-onnxruntime
apt-get install tesseract-ocr tesseract-ocr-kor
python3 -I pipeline.py in.pdf out_dir          # 문제별 png + result.json
python3 -I eval_handwriting.py out_dir/..-red-ink.png
python3 -I build_report.py                      # results/report.html
```
- 글자 레이어 PDF: 줄 맨 앞 `N.` + 2단 자동 분리 (Red 샘플 2/2 문제)
- 스캔: 잉크 가로 투영 + 큼/내어쓰기/주황색/혼자 있음 점수 (Kim 2/2, Hh 실패→전체 1개)
- 필기: PDF의 별도 그림층 bbox만 잘라 HSV로 빨강/파랑 마스크 → 흰 바탕 검정 글씨로 변환 → tesseract kor
결과와 한계는 `results/report.html` 참고.
