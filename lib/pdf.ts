import type { PDFDocumentProxy } from "pdfjs-dist";

const PDFJS_VERSION = "3.11.174";
const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// Loaded from a CDN worker (not bundled) to avoid Next.js/webpack worker bundling issues.
let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  return pdfjs.getDocument({ data: buf }).promise;
}

export interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function renderPageToDataUrl(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  scale = 2
): Promise<RenderedPage> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height };
}

// Bounds are normalized to [0,1] relative to the page image, since Claude
// reasons about layout proportionally rather than in exact pixels.
export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cropDataUrl(
  pageDataUrl: string,
  pageWidth: number,
  pageHeight: number,
  bounds: NormalizedBounds
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const px = {
        x: Math.round(bounds.x * pageWidth),
        y: Math.round(bounds.y * pageHeight),
        width: Math.round(bounds.width * pageWidth),
        height: Math.round(bounds.height * pageHeight),
      };
      const canvas = document.createElement("canvas");
      canvas.width = px.width;
      canvas.height = px.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, px.x, px.y, px.width, px.height, 0, 0, px.width, px.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = reject;
    img.src = pageDataUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
