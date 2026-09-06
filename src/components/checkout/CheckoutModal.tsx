"use client";

import React, { useState } from "react";
import { useUserAccount } from "../auth/AuthProvider";
import { CREDIT_PACKS, CreditPack } from "@/lib/credits";
import { X, CheckCircle2, Zap, Shield, Loader2, ArrowRight } from "lucide-react";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutModal() {
  const { isCheckoutModalOpen, closeCheckoutModal, user, openAuthModal, refreshUser } = useUserAccount();
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [selectedPackId, setSelectedPackId] = useState<string>("pack_15");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isCheckoutModalOpen) return null;

  const selectedPack = CREDIT_PACKS.find((p) => p.id === selectedPackId) || CREDIT_PACKS[1];

  const handleCheckoutStripe = async () => {
    if (!user) {
      closeCheckoutModal();
      openAuthModal();
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: selectedPack.id,
          currency: currency.toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to initialize checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to initialize checkout session");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutRazorpay = async () => {
    if (!user) {
      closeCheckoutModal();
      openAuthModal();
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/checkout/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: selectedPack.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.orderId) {
        throw new Error(data.error || "Failed to create Razorpay order");
      }

      // Dynamically ensure Razorpay checkout script is loaded
      await loadRazorpayScript();

      // Check if Razorpay SDK script exists on window
      interface RazorpayOptions {
        key: string;
        amount: number;
        currency: string;
        name: string;
        description: string;
        order_id: string;
        handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
        prefill: { email?: string };
        theme: { color: string };
      }
      interface RazorpayInstance {
        open: () => void;
      }
      interface WindowWithRazorpay extends Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
      }

      const win = window as WindowWithRazorpay;
      if (typeof win.Razorpay === "function") {
        const rzp = new win.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: "INR",
          name: "Kramix.AI",
          description: selectedPack.title,
          order_id: data.orderId,
          handler: async (response) => {
            try {
              const verifyRes = await fetch("/api/webhooks/razorpay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...response,
                  packId: selectedPack.id,
                }),
              });
              if (verifyRes.ok) {
                await refreshUser();
                closeCheckoutModal();
              } else {
                const verifyData = await verifyRes.json().catch(() => ({}));
                setErrorMessage(verifyData.error || "Payment verification failed. Please contact support.");
              }
            } catch {
              setErrorMessage("Network error verifying payment. Please refresh the page.");
            }
          },
          prefill: {
            email: user.email,
          },
          theme: { color: "#6366f1" },
        });
        rzp.open();
      } else {
        throw new Error("Unable to load Razorpay payment SDK. Please check your network connection.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0a0d14] p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={closeCheckoutModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-xl font-bold text-white">Unlock Live Interview Mode</h2>
            </div>
            <p className="text-xs text-slate-400">
              Real-time company search, adaptive difficulty probes, and authoritative hiring committee dossiers.
            </p>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-surface-100 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                currency === "INR"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                currency === "USD"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Credit Packs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          {CREDIT_PACKS.map((pack) => {
            const isSelected = selectedPackId === pack.id;
            const price = currency === "INR" ? `₹${pack.priceINR}` : `$${pack.priceUSD}`;

            return (
              <div
                key={pack.id}
                onClick={() => setSelectedPackId(pack.id)}
                className={`cursor-pointer relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 scale-[1.02]"
                    : "border-slate-800 bg-surface-100 hover:border-slate-700"
                }`}
              >
                {pack.badge && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow">
                    {pack.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{pack.credits} Credits</h3>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-400" />}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{price}</span>
                    <span className="text-[11px] text-slate-400">
                      ({currency === "INR" ? `₹${(pack.priceINR / pack.credits).toFixed(0)}` : `$${(pack.priceUSD / pack.credits).toFixed(2)}`}/round)
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    {pack.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-medium text-slate-300">
                  ✓ {pack.credits} full live rounds
                </div>
              </div>
            );
          })}
        </div>

        {/* Guarantees & Checkout CTA */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Protected credits: Decremented only upon completed live rounds. Never expires.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {currency === "INR" ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckoutRazorpay}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Pay with UPI / Razorpay (₹{selectedPack.priceINR})</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckoutStripe}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Pay with Stripe (${selectedPack.priceUSD})</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* User state indicator */}
        <div className="mt-4 text-center text-[11px] text-slate-500">
          {user ? (
            <span>Logged in as <strong className="text-slate-300">{user.email}</strong> · Current Balance: <strong className="text-indigo-300">{user.credits} credits</strong></span>
          ) : (
            <span>You will be prompted to sign in with your email to link your purchased credits.</span>
          )}
        </div>
      </div>
    </div>
  );
}
