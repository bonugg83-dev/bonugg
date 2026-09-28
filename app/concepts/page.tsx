"use client";

import { useEffect, useState } from "react";

interface ConceptRow {
  id: string;
  text: string;
  subjectId: string;
  imageUrl: string | null;
}

export default function ConceptsPage() {
  const [q, setQ] = useState("");
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [openImage, setOpenImage] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      fetch(`/api/concepts?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => setConcepts(data.concepts ?? []));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  async function remove(id: string) {
    if (!confirm("이 개념을 삭제할까요? 복습 순환에서 완전히 빠집니다.")) return;
    await fetch(`/api/concepts/${id}`, { method: "DELETE" });
    setConcepts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="검색..."
        className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm"
      />

      {concepts.length === 0 ? (
        <p className="py-12 text-center text-text3">저장된 개념이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {concepts.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <p
                className="cursor-pointer whitespace-pre-wrap"
                onClick={() => c.imageUrl && setOpenImage(c.imageUrl)}
              >
                {c.text}
              </p>
              <button
                onClick={() => remove(c.id)}
                className="mt-2 text-xs text-text3 hover:text-red-600"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {openImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpenImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={openImage} alt="원본" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
