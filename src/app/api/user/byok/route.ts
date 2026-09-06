import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { updateUserEncryptedKey, getUserByEmail } from "@/lib/db";
import { encryptApiKey } from "@/lib/crypto";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readSafeJsonBody, sanitizeString } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  const rateLimitResponse = enforceRateLimit(req, "byok");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: body, error: bodyError } = await readSafeJsonBody<{ apiKey?: string }>(req, 10_000);
    if (bodyError) {
      return NextResponse.json({ error: bodyError }, { status: 400 });
    }

    const rawApiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (rawApiKey.length > 512) {
      return NextResponse.json({ error: "API key exceeds maximum length" }, { status: 400 });
    }
    const apiKey = sanitizeString(rawApiKey, 512);

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!apiKey) {
      // Clear key
      await updateUserEncryptedKey(user.id, null);
      return NextResponse.json({ success: true, hasBYOK: false });
    }

    // Encrypt at rest with AES-256-GCM
    const encrypted = encryptApiKey(apiKey);
    await updateUserEncryptedKey(user.id, encrypted);

    return NextResponse.json({ success: true, hasBYOK: true });
  } catch (err) {
    console.error("BYOK key update error:", err);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}
