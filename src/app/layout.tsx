import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kramix.ai — AI-Powered Realistic Interview Preparation Platform",
  description:
    "Experience hyper-realistic company and role-specific mock interviews with an adaptive AI interviewer, live voice diagnostics, and actionable evaluation reports.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#090c12] text-slate-100 antialiased selection:bg-brand-500/30 selection:text-brand-200">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
          <AuthModal />
          <CheckoutModal />
        </AuthProvider>
      </body>
    </html>
  );
}
