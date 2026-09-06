"use client";

import React from "react";
import { DeviceDiagnostic } from "@/components/device-check/DeviceDiagnostic";
import { RouteGuard } from "@/components/common/RouteGuard";

export default function DeviceCheckPage() {
  return (
    <RouteGuard>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-xs uppercase font-mono font-semibold text-brand-400">Step 3 of 4</span>
          <h1 className="text-2xl font-bold text-white mt-1">Camera & Microphone Diagnostic</h1>
          <p className="text-xs text-slate-400 mt-1">
            Verify audio input levels and video stream clarity before entering the simulation.
          </p>
        </div>

        <DeviceDiagnostic />
      </div>
    </RouteGuard>
  );
}
