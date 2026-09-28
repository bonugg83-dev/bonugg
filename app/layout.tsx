import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "개념노트",
  description: "손으로 푼 문제에서 개념만 모아 밤에 복습하는 앱",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <nav className="flex gap-4 border-b border-border bg-surface px-4 py-3 text-sm font-semibold">
          <a href="/" className="text-accent">
            오늘의 복습
          </a>
          <a href="/upload" className="text-text2">
            업로드
          </a>
          <a href="/concepts" className="text-text2">
            개념모아보기
          </a>
        </nav>
        <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
