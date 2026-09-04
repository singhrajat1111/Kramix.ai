"use client";

import React, { useState } from "react";
import { Mail, Shield, Sparkles, AlertCircle, X } from "lucide-react";

export function Footer() {
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  const emailSubject = encodeURIComponent("Kramix API Key Assistance Request");
  const emailBody = encodeURIComponent(
    `Hello Kramix Team,\n\nI would like to use Kramix for interview preparation, but I currently don't have an AI API key.\n\nMy details:\n\nTarget Role: \nTarget Company: \n\nReason / Message: `
  );

  const handleContactClick = (e: React.MouseEvent) => {
    if (!contactEmail) {
      e.preventDefault();
      setShowConfigAlert(true);
    }
  };

  const mailtoLink = contactEmail ? `mailto:${contactEmail}?subject=${emailSubject}&body=${emailBody}` : "#";

  return (
    <>
      <footer className="w-full border-t border-slate-800/80 bg-[#070a0f] py-8 text-xs text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <span className="font-semibold text-slate-300">Kramix.ai</span>
            <span className="text-slate-500">— Realistic AI Interview Preparation Platform</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href={mailtoLink}
              onClick={handleContactClick}
              className="flex items-center gap-1.5 text-slate-300 hover:text-brand-300 transition-colors cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5 text-brand-400" />
              <span>Need an API Key? Contact Author</span>
            </a>

            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span>Client-Scoped Privacy Guarantee</span>
            </div>
          </div>

          <p className="text-slate-500 text-center sm:text-right">
            © {new Date().getFullYear()} Kramix.ai. Built for high-performance interview simulation.
          </p>
        </div>
      </footer>

      {/* Configuration modal if NEXT_PUBLIC_CONTACT_EMAIL is not set */}
      {showConfigAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0d121d] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-sm font-bold text-white">API Key Assistance Contact</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigAlert(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The project owner has not yet configured <code className="text-brand-300 bg-slate-900 px-1.5 py-0.5 rounded">NEXT_PUBLIC_CONTACT_EMAIL</code> in <code className="text-slate-400">.env.local</code>.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Good news: You can use <strong className="text-slate-200">Demo Mode</strong> to experience full realistic mock interviews right now without needing an API key.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConfigAlert(false)}
                className="rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
