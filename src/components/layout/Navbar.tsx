"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StorageManager } from "@/lib/storage/storage-manager";
import { AIConfig } from "@/types/ai";
import { useUserAccount } from "@/components/auth/AuthProvider";
import { getUnlockedSteps } from "@/lib/guards";
import { signOut } from "next-auth/react";
import {
  Sparkles,
  Cpu,
  ChevronRight,
  Coins,
  Key,
  User as UserIcon,
  LogOut,
  Zap,
  Lock,
} from "lucide-react";

import { KramixLogo } from "@/components/brand/KramixLogo";

export function Navbar() {
  const pathname = usePathname();
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: "demo" });
  const [unlockedSteps, setUnlockedSteps] = useState<Record<string, boolean>>({ "/setup": true });
  const { user, resolvedAccess, openAuthModal, openCheckoutModal } = useUserAccount();

  useEffect(() => {
    setAiConfig(StorageManager.getAIConfig());
    setUnlockedSteps(getUnlockedSteps());
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
          <Link href="/" className="group focus:outline-none">
            <KramixLogo size="md" />
          </Link>
        </div>

        {/* Stepper Navigation (visible on non-home pages) */}
        {pathname !== "/" && (
          <nav className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400">
            {steps.map((step, idx) => {
              const isActive = pathname === step.path;
              const isPast = steps.findIndex((s) => s.path === pathname) > idx;
              const isUnlocked = unlockedSteps[step.path] ?? false;

              return (
                <React.Fragment key={step.path}>
                  {isUnlocked ? (
                    <Link
                      href={step.path}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                        isActive
                          ? "bg-brand-500/20 text-brand-300 font-semibold border border-brand-500/30"
                          : isPast
                          ? "text-slate-300 hover:text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>{step.label}</span>
                    </Link>
                  ) : (
                    <span
                      title="Complete previous steps to unlock"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-600 cursor-not-allowed opacity-60"
                    >
                      <span>{step.label}</span>
                      <Lock className="h-2.5 w-2.5 text-slate-600" />
                    </span>
                  )}
                  {idx < steps.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600" />}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {/* Right Section: Credits, Provider Mode & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Credits Pill (Clicking opens Checkout Modal) */}
          <button
            type="button"
            onClick={openCheckoutModal}
            className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 transition-colors shadow-sm"
          >
            <Coins className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-semibold">{user ? user.credits : 0} Credits</span>
            <span className="hidden sm:inline text-[10px] text-indigo-400/80 font-mono">+ Buy</span>
          </button>

          {/* Mode Pill */}
          <Link
            href="/setup"
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-surface-100/90 px-3 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
          >
            {resolvedAccess.mode === "live" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <span className="font-medium text-slate-200">
                  Live {resolvedAccess.reason === "byok" ? "(BYOK)" : ""}
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-medium text-slate-300">Demo Mode</span>
              </>
            )}
            <Cpu className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
          </Link>

          {/* User Profile / Auth State */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-[11px] font-medium text-slate-300 max-w-[120px] truncate">
                  {user.email}
                </span>
                <span className="text-[10px] text-slate-500 font-mono uppercase">
                  {user.plan} {user.hasBYOK ? "· BYOK" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                title="Sign Out"
                className="p-1.5 rounded-lg border border-slate-800 bg-surface-100 hover:bg-surface-200 text-slate-400 hover:text-white transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand-500/20 transition-all"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
