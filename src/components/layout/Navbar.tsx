"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StorageManager } from "@/lib/storage/storage-manager";
import { AIConfig } from "@/types/ai";
import { Sparkles, ShieldCheck, Cpu, ChevronRight } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: "demo" });

  useEffect(() => {
    setAiConfig(StorageManager.getAIConfig());
  }, [pathname]);

  const steps = [
    { label: "Profile", path: "/setup" },
    { label: "Research", path: "/research" },
    { label: "Check", path: "/device-check" },
    { label: "Interview", path: "/interview" },
    { label: "Report", path: "/results" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border/80 bg-[#090c12]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-accent-purple text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                KRAMIX<span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">AI</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Stepper Navigation (visible on non-home pages) */}
        {pathname !== "/" && (
          <nav className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
            {steps.map((step, idx) => {
              const isActive = pathname === step.path;
              const isPast = steps.findIndex((s) => s.path === pathname) > idx;

              return (
                <React.Fragment key={step.path}>
                  <Link
                    href={step.path}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      isActive
                        ? "bg-brand-500/20 text-brand-300 font-semibold border border-brand-500/30"
                        : isPast
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    <span>{step.label}</span>
                  </Link>
                  {idx < steps.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600" />}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {/* Provider Status Pill */}
        <div className="flex items-center gap-3">
          <Link
            href="/setup"
            className="flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-surface-100/90 px-3 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
          >
            {aiConfig.provider === "demo" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-accent-amber animate-pulse" />
                <span className="font-medium text-slate-300">Demo Mode</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-accent-emerald" />
                <span className="font-medium text-slate-200 capitalize">{aiConfig.provider}</span>
              </>
            )}
            <Cpu className="h-3.5 w-3.5 text-slate-400 ml-1" />
          </Link>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 border border-slate-800 rounded-md px-2 py-1 bg-slate-900/50">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Zero Server Keys</span>
          </div>
        </div>
      </div>
    </header>
  );
}
