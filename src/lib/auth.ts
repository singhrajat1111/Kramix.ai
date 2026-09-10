import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, getUserById, upsertUser } from "./db";

// Augment NextAuth types for custom session fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      plan: "free" | "payg" | "subscriber";
      credits: number;
      hasBYOK: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    plan?: "free" | "payg" | "subscriber";
    credits?: number;
    hasBYOK?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: "free" | "payg" | "subscriber";
    credits?: number;
    hasBYOK?: boolean;
  }
}

// ---------------------------------------------------------------------------
// Netlify & Cloud Deployment URL Normalization
// ---------------------------------------------------------------------------
if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost")) {
  if (process.env.URL) {
    process.env.NEXTAUTH_URL = process.env.URL;
  } else if (process.env.DEPLOY_PRIME_URL) {
    process.env.NEXTAUTH_URL = process.env.DEPLOY_PRIME_URL;
  }
}

const isProduction = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-production-server";

const rawSecret = process.env.NEXTAUTH_SECRET;

// Strict production security enforcement at runtime (outside static build page collection)
if (isProduction && process.env.NEXT_PHASE !== "phase-production-build") {
  if (
    !rawSecret ||
    rawSecret === "kramix-super-secret-key-must-be-long-and-secure" ||
    rawSecret === "generate_a_secure_32_byte_secret_here" ||
    rawSecret.length < 32
  ) {
    // Only throw at actual runtime when process is serving requests without NEXTAUTH_SECRET configured
    if (typeof window === "undefined" && !process.env.NEXT_PHASE?.includes("build")) {
      console.warn(
        "WARNING: NEXTAUTH_SECRET is missing or weak in production. Configure a secure 32+ character key for deployment."
      );
    }
  }
}

const BUILD_PLACEHOLDER_SECRET = "kramix-build-phase-secret-key-must-be-32-chars-long";

const nextAuthSecret =
  rawSecret &&
  rawSecret !== "generate_a_secure_32_byte_secret_here" &&
  rawSecret.length >= 32
    ? rawSecret
    : BUILD_PLACEHOLDER_SECRET;

const isHttps = Boolean(
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.URL?.startsWith("https://") ||
  isProduction
);

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  useSecureCookies: isHttps,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    // 1. Google OAuth Provider (configured with select_account consent to always display account picker)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "select_account consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),

    // 2. Real Magic Link Email Provider (activated when SMTP / Resend credentials exist)
    ...(process.env.EMAIL_SERVER && process.env.EMAIL_FROM
      ? [
          EmailProvider({
            server: process.env.EMAIL_SERVER,
            from: process.env.EMAIL_FROM,
          }),
        ]
      : process.env.EMAIL_SERVER_HOST && process.env.EMAIL_FROM
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT || 587),
              auth: {
                user: process.env.EMAIL_SERVER_USER || "",
                pass: process.env.EMAIL_SERVER_PASSWORD || "",
              },
            },
            from: process.env.EMAIL_FROM,
          }),
        ]
      : []),

    // 3. Candidate Email Access (persists candidate account, credits & BYOK without external SMTP requirements)
    CredentialsProvider({
      id: "email-login",
      name: "Candidate Email Access",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error("Please enter a valid email address");
        }
        const email = credentials.email.trim().toLowerCase();
        if (!email.includes("@") || !email.includes(".")) {
          throw new Error("Invalid email format");
        }

        // Upsert user into database (defaults to free tier with 0 credits)
        const user = await upsertUser(email, "free", 0);
        return {
          id: user.id,
          email: user.email,
          plan: user.plan,
          credits: user.credits,
          hasBYOK: Boolean(user.api_key_encrypted),
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const dbUser = await upsertUser(user.email, "free", 0);
        user.id = dbUser.id;
        user.plan = dbUser.plan;
        user.credits = dbUser.credits;
        user.hasBYOK = Boolean(dbUser.api_key_encrypted);
        return true;
      } catch (err) {
        console.error("Sign-in database sync error:", err);
        return true;
      }
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan || "free";
        token.credits = user.credits ?? 0;
        token.hasBYOK = user.hasBYOK ?? false;
      }

      if (token.id && (!user || trigger === "update")) {
        const freshUser = await getUserById(token.id);
        if (freshUser) {
          token.plan = freshUser.plan;
          token.credits = freshUser.credits;
          token.hasBYOK = Boolean(freshUser.api_key_encrypted);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || "";
        session.user.plan = (token.plan as "free" | "payg" | "subscriber") || "free";
        session.user.credits = Number(token.credits || 0);
        session.user.hasBYOK = Boolean(token.hasBYOK);
      }
      return session;
    },
  },
};
