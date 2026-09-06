import { NextRequest, NextResponse } from "next/server";
import { recordProcessedWebhook, updateUserCredits, updateUserPlan, getUserByEmail, getUserById } from "@/lib/db";
import { getCreditPackById } from "@/lib/credits";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured.");
      return NextResponse.json(
        { error: "Webhook endpoint not configured" },
        { status: 500 }
      );
    }

    if (!sig) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe signature verification failed:", err instanceof Error ? err.message : "Tampered payload");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
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

      // Cryptographically verify that payment was actually received and not pending/unpaid
      if (session.payment_status !== "paid") {
        console.warn(`[Stripe Webhook] Session ${session.id} payment status is "${session.payment_status}", not "paid". Skipping credit grant.`);
        return NextResponse.json({ received: true, credited: false, reason: "payment_not_paid" });
      }

      const packId = session.metadata?.packId;
      const pack = packId ? getCreditPackById(packId) : null;
      if (!pack) {
        console.warn(`[Stripe Webhook] Unknown credit pack "${packId}" in session metadata.`);
        return NextResponse.json({ received: true, credited: false, reason: "invalid_pack" });
      }

      const creditsToAdd = pack.credits;
      const userId = session.metadata?.userId;
      const userEmail = session.metadata?.userEmail || session.customer_details?.email;

      let targetUser = userId ? await getUserById(userId) : null;
      if (!targetUser && userEmail) {
        targetUser = await getUserByEmail(userEmail);
      }

      if (targetUser) {
        await updateUserCredits(targetUser.id, creditsToAdd);
        await updateUserPlan(targetUser.id, "payg");
        console.log(`[Stripe Webhook] Credited ${creditsToAdd} credits to user ${targetUser.email} (ID: ${targetUser.id})`);
      } else {
        console.error(`[Stripe Webhook] Could not locate user record for userId=${userId} userEmail=${userEmail}`);
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
