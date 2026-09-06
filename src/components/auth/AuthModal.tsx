"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useUserAccount } from "./AuthProvider";
import { X, Mail, Sparkles, Loader2, ArrowRight } from "lucide-react";

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, refreshUser } = useUserAccount();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isAuthModalOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await signIn("email-login", {
        email: email.trim().toLowerCase(),
        redirect: false,
      });

      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        await refreshUser();
        closeAuthModal();
      }
    } catch {
      setErrorMessage("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await signIn("email-login", {
        email: demoEmail,
        redirect: false,
      });
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        await refreshUser();
        closeAuthModal();
      }
    } catch {
      setErrorMessage("Quick sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c1017] p-6 shadow-2xl">
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Sign In to Kramix.AI</h2>
            <p className="text-xs text-slate-400">
              Access live web research, dossier exports & credit packs
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          disabled={loading}
          onClick={() => signIn("google")}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-surface-100 hover:bg-surface-200 px-4 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 mb-4 shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-[#0c1017] px-3 text-[11px] text-slate-500 uppercase tracking-wider">
            Or Passwordless Email
          </span>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-xl border border-slate-700 bg-surface-100 px-3.5 py-2.5 pl-9 text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Sign In / Register</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Testing helper */}
        <div className="mt-5 border-t border-slate-800/80 pt-4 text-center">
          <p className="text-[11px] text-slate-500 mb-2">Instant Development Sign-In:</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("candidate@kramix.ai")}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
            >
              candidate@kramix.ai
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("engineer@kramix.ai")}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
            >
              engineer@kramix.ai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
