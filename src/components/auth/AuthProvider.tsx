"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SessionProvider, useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { InterviewModeResolution } from "@/lib/access";

interface UserAccountState {
  id?: string;
  email?: string;
  plan: "free" | "payg" | "subscriber";
  credits: number;
  hasBYOK: boolean;
}

interface UserAccountContextType {
  user: UserAccountState | null;
  resolvedAccess: InterviewModeResolution;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isCheckoutModalOpen: boolean;
  openCheckoutModal: () => void;
  closeCheckoutModal: () => void;
}

const UserAccountContext = createContext<UserAccountContextType>({
  user: null,
  resolvedAccess: { mode: "demo", reason: "unauthenticated" },
  isLoading: true,
  refreshUser: async () => {},
  signOut: async () => {},
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  isCheckoutModalOpen: false,
  openCheckoutModal: () => {},
  closeCheckoutModal: () => {},
});

export function useUserAccount() {
  return useContext(UserAccountContext);
}

function UserAccountInternalProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<UserAccountState | null>(null);
  const [resolvedAccess, setResolvedAccess] = useState<InterviewModeResolution>({
    mode: "demo",
    reason: "unauthenticated",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  const fetchLiveUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/me?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setResolvedAccess(data.resolvedAccess);
          return;
        }
      }
      setUser(null);
      setResolvedAccess({ mode: "demo", reason: "unauthenticated" });
    } catch {
      setUser(null);
      setResolvedAccess({ mode: "demo", reason: "unauthenticated" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setUser(null);
    setResolvedAccess({ mode: "demo", reason: "unauthenticated" });
    try {
      await nextAuthSignOut({ redirect: false });
    } catch (err) {
      console.warn("Sign-out error:", err);
    }
    // Hard refresh to root to ensure all caches and volatile states are scrubbed
    window.location.href = "/";
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !session) {
      setUser(null);
      setResolvedAccess({ mode: "demo", reason: "unauthenticated" });
      setIsLoading(false);
      return;
    }

    fetchLiveUser();
  }, [session, status, fetchLiveUser]);

  return (
    <UserAccountContext.Provider
      value={{
        user,
        resolvedAccess,
        isLoading: status === "loading" || isLoading,
        refreshUser: fetchLiveUser,
        signOut: handleSignOut,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        isCheckoutModalOpen,
        openCheckoutModal: () => setIsCheckoutModalOpen(true),
        closeCheckoutModal: () => setIsCheckoutModalOpen(false),
      }}
    >
      {children}
    </UserAccountContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserAccountInternalProvider>{children}</UserAccountInternalProvider>
    </SessionProvider>
  );
}
