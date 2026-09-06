"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SessionProvider, useSession } from "next-auth/react";
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
      const res = await fetch("/api/user/me", { cache: "no-store" });
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

  useEffect(() => {
    if (status === "loading") return;
    fetchLiveUser();
  }, [session, status, fetchLiveUser]);

  return (
    <UserAccountContext.Provider
      value={{
        user,
        resolvedAccess,
        isLoading: status === "loading" || isLoading,
        refreshUser: fetchLiveUser,
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
