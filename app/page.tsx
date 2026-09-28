"use client";

import { useEffect, useState } from "react";
import type { Rating } from "@/lib/srs";

interface QueueItem {
  id: string;
  text: string;
  subjectId: string;
  imageUrl: string | null;
}

const RATING_BUTTONS: { rating: Rating; label: string; className: string }[] = [
  { rating: "again", label: "다시", className: "bg-red-100 text-red-700" },
  { rating: "hard", label: "어려움", className: "bg-amber-100 text-amber-700" },
  { rating: "good", label: "좋음", className: "bg-emerald-100 text-emerald-700" },
  { rating: "easy", label: "쉬움", className: "bg-accentSoft text-accent" },
];

export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [showImage, setShowImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/review-queue")
      .then((res) => res.json())
      .then((data) => setQueue(data.queue ?? []));
  }, []);

  async function rate(rating: Rating) {
    const current = queue?.[index];
    if (!current || submitting) return;
    setSubmitting(true);
    await fetch(`/api/review/${current.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    setSubmitting(false);
    setShowImage(false);
    setIndex((i) => i + 1);
  }

  if (queue === null) {
    return <p className="text-center text-text3">불러오는 중...</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="py-16 text-center text-text3">
        <div className="mb-3 text-4xl">🎉</div>
        <p>오늘 복습할 개념이 없습니다.</p>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="py-16 text-center text-text3">
        <div className="mb-3 text-4xl">✅</div>
        <p>오늘 밤 복습을 다 마쳤어요.</p>
      </div>
    );
  }

  const current = queue[index];

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-text3">
        {index + 1} / {queue.length}
      </p>

      <div
        className="min-h-[200px] cursor-pointer rounded-xl border border-border bg-surface p-5"
        onClick={() => setShowImage((v) => !v)}
      >
        {showImage && current.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.imageUrl} alt="원본" className="w-full rounded-lg" />
        ) : (
          <p className="whitespace-pre-wrap text-base leading-relaxed">{current.text}</p>
        )}
        <p className="mt-3 text-center text-xs text-text3">
          {showImage ? "탭하여 텍스트 보기" : "탭하여 원본 보기"}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {RATING_BUTTONS.map((b) => (
          <button
            key={b.rating}
            disabled={submitting}
            onClick={() => rate(b.rating)}
            className={`rounded-lg py-3 text-sm font-semibold disabled:opacity-50 ${b.className}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
