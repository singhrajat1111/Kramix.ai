import { NextRequest, NextResponse } from "next/server";
import { recordProcessedWebhook, updateUserCredits, updateUserPlan, getUserByEmail } from "@/lib/db";
import { getCreditPackById } from "@/lib/credits";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    const xSignature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_KEY_SECRET;

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const razorpaySignature = (body.razorpay_signature as string) || xSignature;
    const razorpayOrderId = body.razorpay_order_id as string | undefined;
    const razorpayPaymentId = body.razorpay_payment_id as string | undefined;
    const packId = body.packId as string | undefined;

    // -----------------------------------------------------------------------
    // Real Cryptographic Signature Verification
    // -----------------------------------------------------------------------
    if (secret) {
      if (!razorpaySignature) {
        return NextResponse.json(
          { error: "Missing Razorpay signature" },
          { status: 400 }
        );
      }

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
      }

      const isValid =
        expectedSignature.length > 0 &&
        crypto.timingSafeEqual(
          Buffer.from(expectedSignature, "utf8"),
          Buffer.from(razorpaySignature, "utf8")
        );

      if (!isValid) {
        console.warn("[Razorpay Webhook] Signature verification failed for payload");
        return NextResponse.json(
          { error: "Invalid Razorpay signature: tamper detected" },
          { status: 400 }
        );
      }
    }

    // Determine event ID for strict idempotency
    const eventId =
      (body.event_id as string) ||
      razorpayPaymentId ||
      razorpayOrderId ||
      ((body.payload as Record<string, Record<string, Record<string, string>>>)?.payment?.entity?.id) ||
      `rzp_evt_${Date.now()}`;

    // -----------------------------------------------------------------------
    // Strict Idempotency Check
    // -----------------------------------------------------------------------
    const isNew = await recordProcessedWebhook(eventId, "razorpay");
    if (!isNew) {
      console.log(`[Razorpay Webhook] Event ${eventId} already processed. Rejecting duplicate.`);
      return NextResponse.json({ received: true, duplicate: true, credited: false });
    }

    const pack = getCreditPackById(packId || "") || getCreditPackById("pack_5");
    const creditsToAdd = pack ? pack.credits : 5;

    // Retrieve user email from metadata or payload
    const payloadObj = body.payload as Record<string, unknown> | undefined;
    const paymentObj = payloadObj?.payment as Record<string, unknown> | undefined;
    const entityObj = paymentObj?.entity as Record<string, unknown> | undefined;
    const notesObj = entityObj?.notes as Record<string, string> | undefined;

    const userEmail =
      (body.userEmail as string | undefined) ||
      notesObj?.userEmail;

    if (userEmail) {
      const user = await getUserByEmail(userEmail);
      if (user) {
        await updateUserCredits(user.id, creditsToAdd);
        await updateUserPlan(user.id, "payg");
        console.log(`[Razorpay Webhook] Credited ${creditsToAdd} credits to email ${userEmail}`);
      }
    }

    return NextResponse.json({ received: true, duplicate: false, creditsAdded: creditsToAdd });
  } catch (err) {
    console.error("Razorpay webhook handling error:", err);
    return NextResponse.json(
      { error: "Razorpay webhook failed" },
      { status: 500 }
    );
  }
}
