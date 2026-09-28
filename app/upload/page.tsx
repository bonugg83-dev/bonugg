"use client";

import { useState } from "react";
import {
  loadPdf,
  renderPageToDataUrl,
  cropDataUrl,
  dataUrlToBlob,
  type NormalizedBounds,
} from "@/lib/pdf";
import { SUBJECTS } from "@/lib/subjects";
import { CropAdjuster } from "@/components/CropAdjuster";

interface PageInfo {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

interface CropItem {
  localId: string;
  pageNumber: number;
  bounds: NormalizedBounds;
  cropDataUrl: string;
  text: string;
  included: boolean;
}

type Stage = "idle" | "processing" | "review" | "saving" | "done";

const DEFAULT_MANUAL_BOUNDS: NormalizedBounds = { x: 0.1, y: 0.4, width: 0.8, height: 0.3 };

export default function UploadPage() {
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [items, setItems] = useState<CropItem[]>([]);
  const [sourcePdfId, setSourcePdfId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [mergeCandidate, setMergeCandidate] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  async function handleFile(file: File) {
    setStage("processing");
    setPages([]);
    setItems([]);
    setProgress("PDF 여는 중...");

    const pdfDoc = await loadPdf(file);

    const registerForm = new FormData();
    registerForm.append("file", file);
    registerForm.append("fileName", file.name);
    registerForm.append("pageCount", String(pdfDoc.numPages));
    const registerRes = await fetch("/api/pdfs", { method: "POST", body: registerForm });
    const { id: pdfId } = await registerRes.json();
    setSourcePdfId(pdfId);

    const collectedPages: PageInfo[] = [];
    const collectedItems: CropItem[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      setProgress(`페이지 ${pageNumber}/${pdfDoc.numPages} 분석 중...`);
      const page = await renderPageToDataUrl(pdfDoc, pageNumber);
      collectedPages.push({ pageNumber, ...page });

      const boundsForm = new FormData();
      boundsForm.append("image", dataUrlToBlob(page.dataUrl));
      const boundsRes = await fetch("/api/detect-boundaries", { method: "POST", body: boundsForm });
      const { boxes } = (await boundsRes.json()) as { boxes: NormalizedBounds[] };

      for (const bounds of boxes ?? []) {
        const crop = await cropDataUrl(page.dataUrl, page.width, page.height, bounds);
        const transcribeForm = new FormData();
        transcribeForm.append("image", dataUrlToBlob(crop));
        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          body: transcribeForm,
        });
        const { text } = await transcribeRes.json();

        collectedItems.push({
          localId: `${pageNumber}-${collectedItems.length}`,
          pageNumber,
          bounds,
          cropDataUrl: crop,
          text: text ?? "",
          included: Boolean(text),
        });
      }
    }

    setPages(collectedPages);
    setItems(collectedItems);
    setStage("review");
  }

  function updateItem(localId: string, patch: Partial<CropItem>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  }

  function removeItem(localId: string) {
    setItems((prev) => prev.filter((it) => it.localId !== localId));
  }

  async function addManualCrop(pageNumber: number) {
    const page = pages.find((p) => p.pageNumber === pageNumber);
    if (!page) return;
    const crop = await cropDataUrl(page.dataUrl, page.width, page.height, DEFAULT_MANUAL_BOUNDS);
    setItems((prev) => [
      ...prev,
      {
        localId: `manual-${Date.now()}`,
        pageNumber,
        bounds: DEFAULT_MANUAL_BOUNDS,
        cropDataUrl: crop,
        text: "",
        included: true,
      },
    ]);
  }

  async function confirmCrop(localId: string) {
    const item = items.find((i) => i.localId === localId);
    const page = pages.find((p) => p.pageNumber === item?.pageNumber);
    if (!item || !page) return;
    const crop = await cropDataUrl(page.dataUrl, page.width, page.height, item.bounds);
    updateItem(localId, { cropDataUrl: crop });
    setAdjustingId(null);
  }

  async function retranscribe(localId: string) {
    const item = items.find((i) => i.localId === localId);
    if (!item) return;
    const form = new FormData();
    form.append("image", dataUrlToBlob(item.cropDataUrl));
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    const { text } = await res.json();
    updateItem(localId, { text: text ?? "", included: Boolean(text) });
  }

  function onMergeClick(localId: string) {
    if (!mergeCandidate) {
      setMergeCandidate(localId);
      return;
    }
    if (mergeCandidate === localId) {
      setMergeCandidate(null);
      return;
    }
    mergeItems(mergeCandidate, localId);
    setMergeCandidate(null);
  }

  async function mergeItems(idA: string, idB: string) {
    const a = items.find((i) => i.localId === idA);
    const b = items.find((i) => i.localId === idB);
    if (!a || !b || a.pageNumber !== b.pageNumber) return;
    const page = pages.find((p) => p.pageNumber === a.pageNumber);
    if (!page) return;

    const x = Math.min(a.bounds.x, b.bounds.x);
    const y = Math.min(a.bounds.y, b.bounds.y);
    const right = Math.max(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width);
    const bottom = Math.max(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height);
    const bounds: NormalizedBounds = { x, y, width: right - x, height: bottom - y };
    const crop = await cropDataUrl(page.dataUrl, page.width, page.height, bounds);
    const text = [a.text, b.text].filter(Boolean).join("\n");

    setItems((prev) => [
      ...prev.filter((i) => i.localId !== idA && i.localId !== idB),
      {
        localId: `merged-${Date.now()}`,
        pageNumber: a.pageNumber,
        bounds,
        cropDataUrl: crop,
        text,
        included: true,
      },
    ]);
  }

  async function saveAll() {
    setStage("saving");
    const toSave = items.filter((i) => i.included);
    let count = 0;
    for (const item of toSave) {
      const form = new FormData();
      form.append("image", dataUrlToBlob(item.cropDataUrl));
      form.append("sourcePdfId", sourcePdfId ?? "");
      form.append("pageNumber", String(item.pageNumber));
      form.append("subjectId", subjectId);
      form.append("bounds", JSON.stringify(item.bounds));
      form.append("text", item.text);
      const res = await fetch("/api/concepts", { method: "POST", body: form });
      if (res.ok) count++;
    }
    setSavedCount(count);
    setStage("done");
  }

  const adjustingItem = items.find((i) => i.localId === adjustingId);
  const adjustingPage = pages.find((p) => p.pageNumber === adjustingItem?.pageNumber);

  return (
    <div className="space-y-4">
      {stage === "idle" && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-text2">과목</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center text-sm text-text2">
            푼 PDF 업로드
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {stage === "processing" && (
        <p className="py-16 text-center text-sm text-text2">{progress}</p>
      )}

      {stage === "review" && (
        <div className="space-y-6">
          {pages.map((page) => {
            const pageItems = items.filter((i) => i.pageNumber === page.pageNumber);
            return (
              <div key={page.pageNumber} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-text3">페이지 {page.pageNumber}</p>
                  <button
                    onClick={() => addManualCrop(page.pageNumber)}
                    className="text-xs text-accent"
                  >
                    + 놓친 문제 추가
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pageItems.map((item) => (
                    <div
                      key={item.localId}
                      className={`rounded-lg border p-2 ${
                        mergeCandidate === item.localId ? "border-accent" : "border-border"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.cropDataUrl}
                        alt="크롭"
                        className="mb-2 w-full cursor-pointer rounded"
                        onClick={() => setAdjustingId(item.localId)}
                      />
                      <textarea
                        value={item.text}
                        onChange={(e) => updateItem(item.localId, { text: e.target.value })}
                        placeholder="(메모 없음)"
                        rows={3}
                        className="mb-2 w-full rounded border border-border p-1 text-xs"
                      />
                      <div className="flex items-center justify-between text-xs">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={(e) =>
                              updateItem(item.localId, { included: e.target.checked })
                            }
                          />
                          포함
                        </label>
                        <div className="flex gap-2 text-text3">
                          <button onClick={() => retranscribe(item.localId)}>재인식</button>
                          <button onClick={() => onMergeClick(item.localId)}>병합</button>
                          <button onClick={() => removeItem(item.localId)}>삭제</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            onClick={saveAll}
            className="w-full rounded-lg bg-accent py-3 font-semibold text-white"
          >
            전체 저장 ({items.filter((i) => i.included).length}개)
          </button>
        </div>
      )}

      {stage === "saving" && <p className="py-16 text-center text-sm text-text2">저장하는 중...</p>}

      {stage === "done" && (
        <p className="py-16 text-center text-sm text-text2">
          {savedCount}개 개념이 저장되었어요. 오늘 밤 복습 큐에 나타납니다.
        </p>
      )}

      {adjustingItem && adjustingPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAdjustingId(null)}
        >
          <div
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CropAdjuster
              pageDataUrl={adjustingPage.dataUrl}
              bounds={adjustingItem.bounds}
              onChange={(b) => updateItem(adjustingItem.localId, { bounds: b })}
            />
            <button
              onClick={() => confirmCrop(adjustingItem.localId)}
              className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white"
            >
              확정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
