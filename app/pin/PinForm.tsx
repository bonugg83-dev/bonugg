"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PinForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.replace(params.get("next") || "/");
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xs space-y-3">
      <h1 className="text-center text-lg font-bold text-accent">개념노트</h1>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          setError(false);
        }}
        className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-center text-lg tracking-widest"
        placeholder="PIN"
      />
      {error && <p className="text-center text-sm text-red-600">틀렸어요</p>}
      <button type="submit" className="w-full rounded-lg bg-accent py-3 font-semibold text-white">
        입장
      </button>
    </form>
  );
}
