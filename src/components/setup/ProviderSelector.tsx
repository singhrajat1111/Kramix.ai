"use client";

import React, { useState } from "react";
import { AIConfig, LLMProviderType } from "@/types/ai";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, Key, Mail, ShieldAlert, Cpu } from "lucide-react";

interface ProviderSelectorProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

export function ProviderSelector({ config, onChange }: ProviderSelectorProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
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

  const handleProviderSelect = (provider: LLMProviderType) => {
    setTestResult(null);
    onChange({
      ...config,
      provider,
      apiKey: provider === "demo" ? undefined : config.apiKey,
    });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestResult(null);
    onChange({
      ...config,
      apiKey: e.target.value,
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

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand-400" />
            AI Intelligence Provider
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select your LLM engine. Keys remain strictly client-side and are never logged or stored on our servers.
          </p>
        </div>
      </div>

      {/* Provider Radio Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <button
          type="button"
          onClick={() => handleProviderSelect("demo")}
          className={`flex flex-col items-start p-3.5 rounded-lg border text-left transition-all ${
            config.provider === "demo"
              ? "border-brand-500 bg-brand-500/10 text-white ring-1 ring-brand-500/40"
              : "border-slate-800 bg-surface-100/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="font-semibold text-sm">Demo Engine</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Zero Key
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Instant full interview test with simulated research & adaptive dialogue.
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleProviderSelect("openai")}
          className={`flex flex-col items-start p-3.5 rounded-lg border text-left transition-all ${
            config.provider === "openai"
              ? "border-brand-500 bg-brand-500/10 text-white ring-1 ring-brand-500/40"
              : "border-slate-800 bg-surface-100/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="font-semibold text-sm">OpenAI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              GPT-4o
            </span>
          </div>
          <span className="text-xs text-slate-400">
            High nuance and rapid reasoning via official OpenAI API.
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleProviderSelect("gemini")}
          className={`flex flex-col items-start p-3.5 rounded-lg border text-left transition-all ${
            config.provider === "gemini"
              ? "border-brand-500 bg-brand-500/10 text-white ring-1 ring-brand-500/40"
              : "border-slate-800 bg-surface-100/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="font-semibold text-sm">Google Gemini</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Gemini 1.5
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Fast processing and deep context understanding via Google Generative AI.
          </span>
        </button>
      </div>

      {/* Key Input (if OpenAI or Gemini) */}
      {config.provider !== "demo" ? (
        <div className="space-y-3 pt-1 border-t border-slate-800/60">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-brand-400" />
                {config.provider === "openai" ? "OpenAI API Key (sk-...)" : "Google Gemini API Key"}
              </span>
              <span className="text-[11px] text-slate-400">Session Scoped</span>
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder={config.provider === "openai" ? "sk-proj-..." : "AIzaSy..."}
                value={config.apiKey || ""}
                onChange={handleApiKeyChange}
                className="w-full rounded-lg border border-slate-700 bg-surface-200/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !config.apiKey}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 disabled:opacity-50 transition-colors"
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
                <p className="font-semibold">{testResult.success ? "Connection Verified" : "Verification Failed"}</p>
                <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                {testResult.latencyMs && (
                  <p className="text-[10px] text-slate-400 mt-1">Latency: {testResult.latencyMs}ms</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-300">Demo Mode Active</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              You can experience the entire interview simulator without providing any external keys. When you are ready for custom live LLM synthesis, switch to OpenAI or Google Gemini.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
