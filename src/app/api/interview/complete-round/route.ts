import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getUserById, updateUserCredits } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, ValidationError } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  // 1. Enforce rate limiting
  const rateLimitResponse = enforceRateLimit(req, "round");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{
      fundingSource?: "byok" | "credits" | "subscriber" | "demo";
      roundIndex?: number;
    }>(rawText, 5000);

    const session = await getServerSession(authOptions);
    const fundingSource = body.fundingSource;
    if (fundingSource && !["byok", "credits", "subscriber", "demo"].includes(fundingSource)) {
      throw new ValidationError("Invalid fundingSource value");
    }
    const roundIndex = typeof body.roundIndex === "number" ? body.roundIndex : 0;

    // If candidate ran in demo mode or unauthenticated, no decrement occurs
    if (!session?.user || fundingSource === "demo") {
      return NextResponse.json({
        decremented: false,
        reason: "demo",
        message: "Demo round completed. No credits charged.",
      });
    }

    const user = session.user.id
      ? await getUserById(session.user.id)
      : await getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({
        decremented: false,
        reason: "user_not_found",
      });
    }

    // Authoritative Server-Side Resolution of Funding Source:
    // 1. User with verified BYOK stored at rest never consumes platform credits
    if (Boolean(user.api_key_encrypted)) {
      console.log(`[Round Completed] User ${user.email} completed round #${roundIndex} using verified BYOK. Zero credits charged.`);
      return NextResponse.json({
        decremented: false,
        reason: "byok",
        credits: user.credits,
        message: "BYOK round completed. User's personal API key used; zero credits charged.",
      });
    }

    // 2. Active Subscriber: Unlimited included access
    if (user.plan === "subscriber") {
      console.log(`[Round Completed] Subscriber ${user.email} completed round #${roundIndex}. Unlimited subscriber plan.`);
      return NextResponse.json({
        decremented: false,
        reason: "subscriber",
        credits: user.credits,
        message: "Subscriber round completed. Unlimited access.",
      });
    }

    // 3. Demo fallback if user has 0 credits
    if (user.credits <= 0) {
      return NextResponse.json({
        decremented: false,
        reason: "insufficient_credits",
        credits: user.credits,
        message: "No credits charged.",
      });
    }

    // 4. Credit-funded Live Round: Decrement exactly 1 credit atomically
    const updated = await updateUserCredits(user.id, -1);
    if (!updated) {
      // Failed atomic check (e.g. concurrent race condition exhausted balance)
      console.warn(`[Round Completed] Credit decrement failed for ${user.email} due to insufficient balance / race condition`);
      return NextResponse.json({
        decremented: false,
        reason: "insufficient_credits",
        credits: 0,
      });
    }

    console.log(`[Round Completed] User ${user.email} consumed 1 credit. Remaining credits: ${updated.credits}`);
    return NextResponse.json({
      decremented: true,
      reason: "credits",
      credits: updated.credits,
      message: "1 credit consumed for completed live interview round.",
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Complete round credit decrement failed:", err);
    return NextResponse.json(
      { error: "Failed to process round completion" },
      { status: 500 }
    );
  }
}
