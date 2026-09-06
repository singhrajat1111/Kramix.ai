"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { checkRouteAccess, StepGuardResult } from "@/lib/guards";
import { Loader2, ShieldAlert } from "lucide-react";

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessState, setAccessState] = useState<StepGuardResult | null>(null);

  useEffect(() => {
    const result = checkRouteAccess(pathname);
    setAccessState(result);

    if (!result.allowed && result.redirectPath) {
      console.warn(`[RouteGuard] Access to ${pathname} blocked: ${result.reason}. Redirecting to ${result.redirectPath}`);
      router.replace(result.redirectPath);
    }
  }, [pathname, router]);

  // While evaluating access
  if (!accessState) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  // If unauthorized, show redirect notification
  if (!accessState.allowed) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 max-w-md text-center space-y-3 animate-fadeIn">
          <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Prerequisite Step Required</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {accessState.reason || "Please complete previous steps before entering this stage."}
          </p>
          <p className="text-[11px] text-amber-400 font-mono">
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
