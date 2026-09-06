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

const isProduction = process.env.NODE_ENV === "production";
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (isProduction) {
  if (
    !nextAuthSecret ||
    nextAuthSecret === "kramix-super-secret-key-must-be-long-and-secure" ||
    nextAuthSecret === "generate_a_secure_32_byte_secret_here" ||
    nextAuthSecret.length < 32
  ) {
    throw new Error(
      "FATAL CONFIGURATION ERROR: NEXTAUTH_SECRET must be set to a secure string of at least 32 characters in production."
    );
  }
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret || "kramix-super-secret-key-must-be-long-and-secure",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    // 1. Google OAuth Provider (activated when Google OAuth credentials exist)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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

    // 3. Passwordless Direct Email Sign-In (strictly non-production development/test only)
    ...(!isProduction
      ? [
          CredentialsProvider({
            id: "email-login",
            name: "Passwordless Email (Development Only)",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "you@example.com" },
            },
            async authorize(credentials) {
              if (process.env.NODE_ENV === "production") {
                throw new Error("Passwordless credentials login is disabled in production.");
              }
              if (!credentials?.email) {
                throw new Error("Please enter a valid email address");
              }
              const email = credentials.email.trim().toLowerCase();
              if (!email.includes("@")) {
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
        ]
      : []),
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
  pages: {
    signIn: "/setup",
  },
};
