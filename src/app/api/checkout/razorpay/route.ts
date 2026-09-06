import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCreditPackById } from "@/lib/credits";
import { updateUserCredits, updateUserPlan, getUserByEmail } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, ValidationError } from "@/lib/security/validation";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout creations / minute
  const rateLimitResponse = enforceRateLimit(req, "checkout");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{ packId?: string }>(rawText, 5000);

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { packId } = body;
    const pack = getCreditPackById(packId || "");
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If Razorpay keys are unconfigured (e.g. dev testing), simulate success safely
    if (!keyId || !keySecret) {
      console.warn("RAZORPAY_KEY_ID / SECRET not set in environment. Running in dev simulation mode.");
      const user = await getUserByEmail(session.user.email);
      if (user) {
        await updateUserCredits(user.id, pack.credits);
        await updateUserPlan(user.id, "payg");
      }
      return NextResponse.json({
        simulatedSuccess: true,
        credits: pack.credits,
        message: "Development test: credits added successfully",
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const amountInPaise = pack.priceINR * 100;
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: session.user.id,
        userEmail: session.user.email,
        packId: pack.id,
        credits: String(pack.credits),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      keyId,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Razorpay order creation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
