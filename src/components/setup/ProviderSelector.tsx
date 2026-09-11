"use client";

import React, { useState, useMemo } from "react";
import { AIConfig, LLMProviderType } from "@/types/ai";
import { detectProviderFromKey } from "@/lib/ai/factory";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Key,
  Mail,
  ShieldAlert,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Zap,
  SlidersHorizontal,
} from "lucide-react";

interface ProviderSelectorProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

export function ProviderSelector({ config, onChange }: ProviderSelectorProps) {
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
    provider?: string;
    providerName?: string;
  } | null>(null);

  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const emailSubject = encodeURIComponent("Kramix API Key Assistance Request");
  const emailBody = encodeURIComponent(
    `Hello Kramix Team,\n\nI would like to use Kramix for interview preparation, but I currently don't have an AI API key.\n\nMy details:\n\nTarget Role:\nTarget Company:\n\nReason / Message:\n`
  );
  const mailtoLink = contactEmail ? `mailto:${contactEmail}?subject=${emailSubject}&body=${emailBody}` : "#";

  const handleContactClick = (e: React.MouseEvent) => {
    if (!contactEmail) {
      e.preventDefault();
      setShowConfigNotice(true);
    }
  };

  // Auto-detect the provider from the key pattern
  const detectedProvider = useMemo(() => {
    if (!config.apiKey || !config.apiKey.trim()) return null;
    return detectProviderFromKey(config.apiKey);
  }, [config.apiKey]);

  // Is demo mode currently active?
  const isDemoMode = config.provider === "demo";

  const handleModeSelect = (mode: "demo" | "universal") => {
    setTestResult(null);
    if (mode === "demo") {
      onChange({
        ...config,
        provider: "demo",
        apiKey: undefined,
      });
    } else {
      // Switch to universal key mode
      const detected = detectProviderFromKey(config.apiKey);
      onChange({
        ...config,
        provider: config.apiKey ? detected : "universal",
      });
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestResult(null);
    const newKey = e.target.value;
    const detected = detectProviderFromKey(newKey);
    // If not manually locked to a specific provider, auto-route to detected provider
    const nextProvider = config.provider === "universal" || config.provider === "gemini" || config.provider === "openai" || config.provider === "openrouter"
      ? (newKey.trim() ? detected : "universal")
      : config.provider;

    onChange({
      ...config,
      apiKey: newKey,
      provider: nextProvider,
    });
  };

  const handleProviderOverride = (provider: LLMProviderType) => {
    setTestResult(null);
    onChange({
      ...config,
      provider,
    });
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({
        success: false,
        message: "Failed to connect to Kramix verification endpoint",
      });
    } finally {
      setTesting(false);
    }
  };

  const activeProviderLabel = () => {
    if (config.provider === "gemini") return "Google Gemini (1.5 Flash)";
    if (config.provider === "openai") return "OpenAI (GPT-4o)";
    if (config.provider === "openrouter") return "OpenRouter (Universal Gateway)";
    if (detectedProvider === "gemini") return "Google Gemini (Auto-Detected)";
    if (detectedProvider === "openai") return "OpenAI (Auto-Detected)";
    if (detectedProvider === "openrouter") return "OpenRouter (Auto-Detected)";
    return null;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand-400" />
            AI Intelligence Provider
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure your AI intelligence engine. Keys remain strictly client-side and are never logged or stored on our servers.
          </p>
        </div>
      </div>

      {/* Primary Selector Cards: Demo vs Universal API Key */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {/* Option 1: Demo Engine */}
        <button
          type="button"
          onClick={() => handleModeSelect("demo")}
          className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
            isDemoMode
              ? "border-amber-500/60 bg-amber-500/10 text-white ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/5"
              : "border-slate-800 bg-surface-100/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Cpu className={`h-4 w-4 ${isDemoMode ? "text-amber-400" : "text-slate-400"}`} />
              Demo Engine
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Zero Key
            </span>
          </div>
          <span className="text-xs text-slate-400 leading-relaxed">
            Instant full interview test with pre-built realistic questions, adaptive simulation, and zero setup.
          </span>
        </button>

        {/* Option 2: Universal API Key */}
        <button
          type="button"
          onClick={() => handleModeSelect("universal")}
          className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
            !isDemoMode
              ? "border-brand-500 bg-brand-500/10 text-white ring-1 ring-brand-500/40 shadow-lg shadow-brand-500/10"
              : "border-slate-800 bg-surface-100/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${!isDemoMode ? "text-brand-400" : "text-slate-400"}`} />
              Universal AI Key
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Auto-Detect
            </span>
          </div>
          <span className="text-xs text-slate-400 leading-relaxed mb-2">
            Universal key acceptor. Paste your key and Kramix automatically detects and routes to the correct engine.
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">Gemini</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">OpenAI</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">OpenRouter</span>
          </div>
        </button>
      </div>

      {/* Universal Key Input Section */}
      {!isDemoMode ? (
        <div className="space-y-3 pt-3 border-t border-slate-800/60">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-brand-400" />
                Universal API Key
              </label>

              <div className="flex items-center gap-2">
                {/* Auto-detected Provider Pill */}
                {activeProviderLabel() ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      config.provider === "gemini" || detectedProvider === "gemini"
                        ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                        : config.provider === "openai" || detectedProvider === "openai"
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                    }`}
                  >
                    {config.provider === "gemini" || detectedProvider === "gemini" ? (
                      <Sparkles className="h-3 w-3 text-cyan-400" />
                    ) : config.provider === "openai" || detectedProvider === "openai" ? (
                      <Zap className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Globe className="h-3 w-3 text-purple-400" />
                    )}
                    {activeProviderLabel()}
                  </span>
                ) : (
                  <span className="hidden sm:inline-block text-[11px] text-slate-400">
                    Accepts Gemini (AIza...), OpenAI (sk-...), OpenRouter (sk-or-...)
                  </span>
                )}

                <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-slate-800/60 border border-slate-800">
                  Session Scoped
                </span>
              </div>
            </div>

            {/* Input Box with Show/Hide Toggle */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Paste any API key (e.g. AIzaSy..., sk-..., sk-or-...)"
                value={config.apiKey || ""}
                onChange={handleApiKeyChange}
                className="w-full rounded-lg border border-slate-700 bg-surface-200/80 pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                title={showPassword ? "Hide API key" : "Show API key"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Engine Customization / Override Toggle */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowManualOverride(!showManualOverride)}
              className="text-[11px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="h-3 w-3 text-brand-400" />
              <span>{showManualOverride ? "Hide engine options" : "Override engine selection"}</span>
            </button>

            {/* Small provider selector if expanded */}
            {showManualOverride && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px]">Force:</span>
                <button
                  type="button"
                  onClick={() => handleProviderOverride("universal")}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    config.provider === "universal"
                      ? "bg-brand-500/20 text-brand-300 border-brand-500/40 font-medium"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderOverride("gemini")}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    config.provider === "gemini"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-medium"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  Gemini
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderOverride("openai")}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    config.provider === "openai"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  OpenAI
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderOverride("openrouter")}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    config.provider === "openrouter"
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-medium"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  OpenRouter
                </button>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !config.apiKey}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 disabled:opacity-50 transition-colors shadow-sm"
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" />
                  <span>Validating Key...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            {/* Assistance link */}
            <div className="text-xs text-slate-400">
              Don&apos;t have an API key?{" "}
              <a
                href={mailtoLink}
                onClick={handleContactClick}
                className="text-brand-400 hover:text-brand-300 underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Mail className="h-3 w-3" />
                Contact Kramix Author
              </a>
            </div>
          </div>

          {/* Configuration alert modal when email not set in .env */}
          {showConfigNotice && (
            <div className="mt-3 rounded-lg border border-slate-700 bg-surface-200/90 p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-white">Project Config Notice</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  <code className="text-brand-300">NEXT_PUBLIC_CONTACT_EMAIL</code> is not yet configured in <code className="text-slate-300">.env.local</code>. You can click <strong className="text-white">Demo Engine</strong> above to immediately practice full realistic interviews with zero keys required.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfigNotice(false)}
                  className="mt-2 text-[10px] uppercase font-mono tracking-wider font-semibold text-brand-400 hover:text-brand-300"
                >
                  Dismiss Notice
                </button>
              </div>
            </div>
          )}

          {/* Test connection output banner */}
          {testResult && (
            <div
              className={`mt-2 flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
                testResult.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{testResult.success ? "Connection Verified" : "Verification Failed"}</p>
                  {testResult.providerName && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      {testResult.providerName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                {testResult.latencyMs && (
                  <p className="text-[10px] text-slate-400 mt-1">Latency: {testResult.latencyMs}ms</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-300">Demo Mode Active</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              You can experience the entire interview simulator without providing any external keys. When you are ready for custom live LLM synthesis, switch to Universal AI Key.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
