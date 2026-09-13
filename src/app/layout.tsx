import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kramix V2 — AI Interview Intelligence Platform",
  description:
    "Autonomous, multi-round technical interview simulator powered by graph-driven adaptive questioning, deterministic fallback, and instant hiring committee reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#090c12] text-slate-100 antialiased">
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#090c12]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                K
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Kramix<span className="text-indigo-400">.ai</span>
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/interview"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-sm shadow-indigo-600/30"
              >
                Start Interview
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-[#07090e] py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 Kramix.ai — Realistic AI Technical Interview Platform</span>
            <div className="flex items-center gap-4 text-slate-500 text-xs">
              <span>Privacy Safe</span>
              <span>•</span>
              <span>Instant Reports</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
