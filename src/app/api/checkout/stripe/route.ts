import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCreditPackById } from "@/lib/credits";
import { updateUserCredits, updateUserPlan, getUserByEmail } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parseSafeJSON, ValidationError } from "@/lib/security/validation";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout creations / minute
  const rateLimitResponse = enforceRateLimit(req, "checkout");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const rawText = await req.text();
    const body = parseSafeJSON<{ packId?: string; currency?: string }>(rawText, 5000);

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { packId, currency = "usd" } = body;
    const pack = getCreditPackById(packId || "");
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const origin = req.headers.get("origin") || "http://localhost:3000";

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe payment gateway is currently not configured" },
        { status: 503 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
    });

    const isINR = currency.toLowerCase() === "inr";
    const unitAmount = isINR ? pack.priceINR * 100 : Math.round(pack.priceUSD * 100);

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: isINR ? "inr" : "usd",
            product_data: {
              name: `Kramix.AI — ${pack.title}`,
              description: pack.description,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/setup?checkout=success&credits=${pack.credits}`,
      cancel_url: `${origin}/setup?checkout=cancelled`,
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
        userEmail: session.user.email,
        packId: pack.id,
        credits: String(pack.credits),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initialize checkout" },
      { status: 500 }
    );
  }
}
