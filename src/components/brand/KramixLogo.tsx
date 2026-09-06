import React from "react";

interface KramixLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  glow?: boolean;
}

export function KramixLogo({
  size = "md",
  showText = true,
  className = "",
  glow = true,
}: KramixLogoProps) {
  const sizeMap = {
    sm: { icon: 24, text: "text-base", badge: "text-[10px] px-1 py-0.2" },
    md: { icon: 34, text: "text-lg", badge: "text-xs px-1.5 py-0.5" },
    lg: { icon: 44, text: "text-2xl", badge: "text-xs px-2 py-0.5" },
    xl: { icon: 60, text: "text-3xl", badge: "text-sm px-2.5 py-1" },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Geometric Kramix Monogram Icon */}
      <div
        className={`relative flex items-center justify-center rounded-xl transition-all duration-300 ${
          glow ? "group-hover:drop-shadow-[0_0_16px_rgba(99,102,241,0.5)]" : ""
        }`}
        style={{ width: currentSize.icon, height: currentSize.icon }}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          <defs>
            {/* Ambient Background Gradient */}
            <linearGradient id="kramix-bg-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1e1b4b" />
              <stop offset="0.5" stopColor="#0f172a" />
              <stop offset="1" stopColor="#090d16" />
            </linearGradient>

            {/* Spine Vertical Gradient */}
            <linearGradient id="kramix-spine-grad" x1="12" y1="12" x2="24" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#818cf8" />
              <stop offset="0.6" stopColor="#6366f1" />
              <stop offset="1" stopColor="#4338ca" />
            </linearGradient>

            {/* Upper Diagonal Gradient */}
            <linearGradient id="kramix-up-grad" x1="24" y1="32" x2="52" y2="12" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06b6d4" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#6366f1" />
            </linearGradient>

            {/* Lower Diagonal Gradient */}
            <linearGradient id="kramix-down-grad" x1="24" y1="32" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" />
              <stop offset="0.6" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#d946ef" />
            </linearGradient>

            {/* Core Neural Pulse Gradient */}
            <radialGradient id="kramix-pulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>

            {/* Subtle Border Glow */}
            <linearGradient id="kramix-border-glow" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#818cf8" stopOpacity="0.6" />
              <stop offset="0.5" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Rounded Container Plate */}
          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx="14"
            fill="url(#kramix-bg-grad)"
            stroke="url(#kramix-border-glow)"
            strokeWidth="1.5"
          />

          {/* Left Vertical Spine of 'K' */}
          <rect
            x="14"
            y="14"
            width="9"
            height="36"
            rx="4.5"
            fill="url(#kramix-spine-grad)"
          />

          {/* Upper Diagonal Arm of 'K' */}
          <path
            d="M26 31C27.5 29.5 29 27.5 31 25L43.5 15.5C45.2 14.2 47.7 15.4 47.7 17.5C47.7 18.6 47.1 19.6 46.2 20.3L34.5 29.5C33 30.7 33 33 34.5 34.2L46.5 43.8C47.4 44.5 47.8 45.6 47.6 46.7C47.4 48.6 45 49.6 43.3 48.2L31 38.5C29 36.8 27.5 34.5 26 33"
            fill="url(#kramix-up-grad)"
            strokeLinecap="round"
          />

          {/* Lower Diagonal Wing accent */}
          <path
            d="M33 33L44.5 43C45.8 44.1 46 46.1 44.9 47.4C43.8 48.7 41.8 48.9 40.5 47.8L28.5 37.5C27 36.2 26 34.5 25.5 32.8"
            fill="url(#kramix-down-grad)"
          />

          {/* Central AI Aperture / Voice Pulse Node */}
          <circle
            cx="28"
            cy="32"
            r="4.5"
            fill="url(#kramix-pulse)"
          />
          <circle
            cx="28"
            cy="32"
            r="2"
            fill="#ffffff"
          />
        </svg>
      </div>

      {/* Brand Text Typography */}
      {showText && (
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight text-white font-mono ${currentSize.text} flex items-center`}>
            KRAMIX
          </span>
          <span
            className={`font-bold tracking-wider rounded-md bg-gradient-to-r from-brand-500/25 to-cyan-500/25 text-transparent bg-clip-text border border-brand-500/40 text-brand-300 ${currentSize.badge}`}
          >
            AI
          </span>
        </div>
      )}
    </div>
  );
}
