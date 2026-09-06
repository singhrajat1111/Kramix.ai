import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCreditPackById } from "@/lib/credits";
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

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay payment gateway is currently not configured" },
        { status: 503 }
      );
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
