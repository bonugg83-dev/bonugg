"use client";

import { useRef } from "react";
import type { NormalizedBounds } from "@/lib/pdf";

type DragMode = "move" | "nw" | "ne" | "sw" | "se";

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function CropAdjuster({
  pageDataUrl,
  bounds,
  onChange,
}: {
  pageDataUrl: string;
  bounds: NormalizedBounds;
  onChange: (b: NormalizedBounds) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startBounds: NormalizedBounds;
  } | null>(null);

  function onMove(e: PointerEvent) {
    const state = dragState.current;
    const container = containerRef.current;
    if (!state || !container) return;
    const rect = container.getBoundingClientRect();
    const dx = (e.clientX - state.startX) / rect.width;
    const dy = (e.clientY - state.startY) / rect.height;
    const b = state.startBounds;
    const next: NormalizedBounds = { ...b };

    if (state.mode === "move") {
      next.x = clamp01(b.x + dx);
      next.y = clamp01(b.y + dy);
    } else if (state.mode === "se") {
      next.width = clamp01(b.x + b.width + dx) - b.x;
      next.height = clamp01(b.y + b.height + dy) - b.y;
    } else if (state.mode === "nw") {
      const newX = clamp01(b.x + dx);
      const newY = clamp01(b.y + dy);
      next.width = b.x + b.width - newX;
      next.height = b.y + b.height - newY;
      next.x = newX;
      next.y = newY;
    } else if (state.mode === "ne") {
      const newY = clamp01(b.y + dy);
      next.width = clamp01(b.x + b.width + dx) - b.x;
      next.height = b.y + b.height - newY;
      next.y = newY;
    } else if (state.mode === "sw") {
      const newX = clamp01(b.x + dx);
      next.width = b.x + b.width - newX;
      next.height = clamp01(b.y + b.height + dy) - b.y;
      next.x = newX;
    }

    next.width = Math.max(0.02, Math.min(next.width, 1 - next.x));
    next.height = Math.max(0.02, Math.min(next.height, 1 - next.y));
    onChange(next);
  }

  function onUp() {
    dragState.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  function startDrag(mode: DragMode, e: React.PointerEvent) {
    e.stopPropagation();
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, startBounds: bounds };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const handleClass =
    "absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent";

  return (
    <div ref={containerRef} className="relative w-full select-none touch-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pageDataUrl} alt="페이지" className="w-full rounded-lg" draggable={false} />
      <div
        onPointerDown={(e) => startDrag("move", e)}
        className="absolute border-2 border-accent bg-accent/10"
        style={{
          left: `${bounds.x * 100}%`,
          top: `${bounds.y * 100}%`,
          width: `${bounds.width * 100}%`,
          height: `${bounds.height * 100}%`,
          cursor: "move",
        }}
      >
        <div
          onPointerDown={(e) => startDrag("nw", e)}
          className={handleClass}
          style={{ left: 0, top: 0, cursor: "nwse-resize" }}
        />
        <div
          onPointerDown={(e) => startDrag("ne", e)}
          className={handleClass}
          style={{ left: "100%", top: 0, cursor: "nesw-resize" }}
        />
        <div
          onPointerDown={(e) => startDrag("sw", e)}
          className={handleClass}
          style={{ left: 0, top: "100%", cursor: "nesw-resize" }}
        />
        <div
          onPointerDown={(e) => startDrag("se", e)}
          className={handleClass}
          style={{ left: "100%", top: "100%", cursor: "nwse-resize" }}
        />
      </div>
    </div>
  );
}
