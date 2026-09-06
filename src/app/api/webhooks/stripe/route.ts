import { NextRequest, NextResponse } from "next/server";
import { recordProcessedWebhook, updateUserCredits, updateUserPlan, getUserByEmail } from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret) {
      if (!sig) {
        return NextResponse.json(
          { error: "Missing stripe-signature header" },
          { status: 400 }
        );
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
      });

      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err) {
        console.error("Stripe signature verification failed:", err instanceof Error ? err.message : err);
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 400 }
        );
      }
    } else {
      // In local testing when webhook secret is explicitly unset
      try {
        event = JSON.parse(rawBody) as Stripe.Event;
      } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      }
    }

    if (!event || !event.id) {
      return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // Strict Idempotency Check:
    // Guarantees Stripe retries will NEVER double-credit a user
    // -----------------------------------------------------------------------
    const isNew = await recordProcessedWebhook(event.id, "stripe");
    if (!isNew) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed. Rejecting duplicate.`);
      return NextResponse.json({ received: true, duplicate: true, credited: false });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const creditsToAdd = Number(session.metadata?.credits || 0);
      const userId = session.metadata?.userId;
      const userEmail = session.metadata?.userEmail || session.customer_details?.email;

      if (creditsToAdd > 0) {
        if (userId) {
          await updateUserCredits(userId, creditsToAdd);
          await updateUserPlan(userId, "payg");
          console.log(`[Stripe Webhook] Credited ${creditsToAdd} credits to user ID ${userId}`);
        } else if (userEmail) {
          const user = await getUserByEmail(userEmail);
          if (user) {
            await updateUserCredits(user.id, creditsToAdd);
            await updateUserPlan(user.id, "payg");
            console.log(`[Stripe Webhook] Credited ${creditsToAdd} credits to email ${userEmail}`);
          }
        }
      }
    }

    return NextResponse.json({ received: true, duplicate: false, credited: true });
  } catch (err) {
    console.error("Stripe webhook handling failed:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
