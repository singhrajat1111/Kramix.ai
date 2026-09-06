import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getUserById } from "@/lib/db";
import { resolveInterviewAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        resolvedAccess: { mode: "demo", reason: "unauthenticated" },
      });
    }

    // Always fetch fresh DB state to avoid stale JWT cached credits
    let user = session.user.id
      ? await getUserById(session.user.id)
      : await getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        resolvedAccess: { mode: "demo", reason: "unauthenticated" },
      });
    }

    const hasBYOK = Boolean(user.api_key_encrypted && user.api_key_encrypted.trim().length > 0);
    const resolvedAccess = resolveInterviewAccess({
      plan: user.plan,
      credits: user.credits,
      hasBYOK,
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        credits: user.credits,
        hasBYOK,
      },
      resolvedAccess,
    });
  } catch (err) {
    console.error("GET /api/user/me error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user state" },
      { status: 500 }
    );
  }
}
