import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { recordProcessedWebhook, updateUserCredits, updateUserPlan, getUserByEmail, getUserById } from "@/lib/db";
import { getCreditPackById } from "@/lib/credits";
import crypto from "crypto";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    const xSignature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!secret) {
      console.error("[Razorpay Webhook] RAZORPAY_KEY_SECRET is not configured.");
      return NextResponse.json(
        { error: "Webhook endpoint not configured" },
        { status: 500 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const razorpaySignature = (body.razorpay_signature as string) || xSignature;
    const razorpayOrderId = body.razorpay_order_id as string | undefined;
    const razorpayPaymentId = body.razorpay_payment_id as string | undefined;

    if (!razorpaySignature) {
      return NextResponse.json(
        { error: "Missing Razorpay cryptographic signature" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Cryptographic Signature Verification
    // -----------------------------------------------------------------------
    let expectedSignature = "";
    if (xSignature) {
      // Standard server-to-server webhook: HMAC over raw request text
      expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawText)
        .digest("hex");
    } else if (razorpayOrderId && razorpayPaymentId) {
      // Client checkout verification callback: HMAC over orderId|paymentId
      expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");
    } else {
      return NextResponse.json(
        { error: "Invalid verification parameters" },
        { status: 400 }
      );
    }

    const isValid =
      expectedSignature.length > 0 &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf8"),
        Buffer.from(razorpaySignature, "utf8")
      );

    if (!isValid) {
      console.warn("[Razorpay Webhook] Cryptographic signature verification failed");
      return NextResponse.json(
        { error: "Invalid Razorpay signature: tamper detected" },
        { status: 400 }
      );
    }

    // Determine event ID for strict idempotency
    const eventId =
      (body.event_id as string) ||
      razorpayPaymentId ||
      ((body.payload as Record<string, Record<string, Record<string, string>>>)?.payment?.entity?.id);

    if (!eventId) {
      return NextResponse.json({ error: "Missing verifiable event or payment ID" }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // Strict Idempotency Check
    // -----------------------------------------------------------------------
    const isNew = await recordProcessedWebhook(eventId, "razorpay");
    if (!isNew) {
      console.log(`[Razorpay Webhook] Event ${eventId} already processed. Rejecting duplicate.`);
      return NextResponse.json({ received: true, duplicate: true, credited: false });
    }

    // -----------------------------------------------------------------------
    // Authoritative Pack & User Extraction (Server-controlled, never client-trusted)
    // -----------------------------------------------------------------------
    let verifiedPackId: string | undefined;
    let verifiedUserId: string | undefined;
    let verifiedUserEmail: string | undefined;

    // A. If server-to-server webhook payload:
    const payloadObj = body.payload as Record<string, unknown> | undefined;
    const paymentObj = payloadObj?.payment as Record<string, unknown> | undefined;
    const entityObj = paymentObj?.entity as Record<string, unknown> | undefined;
    const webhookNotes = entityObj?.notes as Record<string, string> | undefined;

    if (webhookNotes) {
      verifiedPackId = webhookNotes.packId;
      verifiedUserId = webhookNotes.userId;
      verifiedUserEmail = webhookNotes.userEmail;
    }

    // B. If client checkout verification callback: fetch authoritative order from Razorpay API
    if (!verifiedPackId && razorpayOrderId && keyId) {
      try {
        const rzp = new Razorpay({ key_id: keyId, key_secret: secret });
        const order = (await rzp.orders.fetch(razorpayOrderId)) as {
          notes?: Record<string, string>;
          amount?: number;
          amount_paid?: number;
          status?: string;
        };
        if (order?.notes) {
          verifiedPackId = order.notes.packId;
          verifiedUserId = order.notes.userId;
          verifiedUserEmail = order.notes.userEmail;
        }
      } catch (err) {
        console.warn("[Razorpay] Failed to fetch order from Razorpay API:", err instanceof Error ? err.message : err);
      }
    }

    // Fallback for user identity: authenticated session if matching
    const session = await getServerSession(authOptions);
    if (!verifiedUserId && session?.user?.id) {
      verifiedUserId = session.user.id;
    }
    if (!verifiedUserEmail && session?.user?.email) {
      verifiedUserEmail = session.user.email;
    }

    const pack = getCreditPackById(verifiedPackId || "");
    if (!pack) {
      console.warn(`[Razorpay Webhook] Could not resolve authoritative credit pack for order ${razorpayOrderId}`);
      return NextResponse.json(
        { error: "Could not resolve valid credit pack from payment order" },
        { status: 400 }
      );
    }

    const creditsToAdd = pack.credits;
    let targetUser = verifiedUserId ? await getUserById(verifiedUserId) : null;
    if (!targetUser && verifiedUserEmail) {
      targetUser = await getUserByEmail(verifiedUserEmail);
    }

    if (!targetUser) {
      console.error(`[Razorpay Webhook] User not found for payment: userId=${verifiedUserId}, email=${verifiedUserEmail}`);
      return NextResponse.json({ error: "User associated with payment not found" }, { status: 404 });
    }

    await updateUserCredits(targetUser.id, creditsToAdd);
    await updateUserPlan(targetUser.id, "payg");
    console.log(`[Razorpay Webhook] Credited ${creditsToAdd} credits to user ${targetUser.email} (ID: ${targetUser.id})`);

    return NextResponse.json({ received: true, duplicate: false, creditsAdded: creditsToAdd });
  } catch (err) {
    console.error("Razorpay webhook handling error:", err);
    return NextResponse.json(
      { error: "Razorpay webhook processing failed" },
      { status: 500 }
    );
  }
}
