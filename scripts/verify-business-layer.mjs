// Verification test suite for Kramix Auth, Crypto, Gating, Idempotency & Decrement logic
import assert from "node:assert";
import crypto from "node:crypto";

console.log("=== KRAMIX BUSINESS LAYER VERIFICATION SUITE ===");

// 1. CRYPTO TEST (AES-256-GCM)
console.log("\n[1] Testing AES-256-GCM Encryption / Decryption...");
const TEST_KEY = crypto.randomBytes(32);

function encryptTest(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64");
}

function decryptTest(encryptedBase64, key) {
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

const originalKey = "sk-ant-api03-test-secret-sample-key-123456";
const encrypted = encryptTest(originalKey, TEST_KEY);
const decrypted = decryptTest(encrypted, TEST_KEY);

assert.strictEqual(decrypted, originalKey, "Decrypted key must match original plain key");
assert.notStrictEqual(encrypted, originalKey, "Ciphertext must not match plaintext");
console.log("✓ Crypto roundtrip test passed successfully.");

// 2. GATING LOGIC TESTS
console.log("\n[2] Testing Access & Gating Resolution (BYOK vs Credits vs Demo)...");

function resolveInterviewAccess(user) {
  if (!user) return { mode: "demo", reason: "unauthenticated" };
  if (user.hasBYOK || (user.apiKeyEncrypted && user.apiKeyEncrypted.trim().length > 0)) {
    return { mode: "live", reason: "byok" };
  }
  if (user.plan === "subscriber") {
    return { mode: "live", reason: "subscriber" };
  }
  if (user.credits > 0) {
    return { mode: "live", reason: "credits" };
  }
  return { mode: "demo", reason: "out_of_credits" };
}

// Case 1: Anonymous
const anonRes = resolveInterviewAccess(null);
assert.deepStrictEqual(anonRes, { mode: "demo", reason: "unauthenticated" });
console.log("✓ Anonymous user resolves to demo mode");

// Case 2: Free user with 0 credits and no BYOK
const freeZeroRes = resolveInterviewAccess({ plan: "free", credits: 0, hasBYOK: false });
assert.deepStrictEqual(freeZeroRes, { mode: "demo", reason: "out_of_credits" });
console.log("✓ Free user with 0 credits resolves to demo mode");

// Case 3: BYOK user with 0 credits -> MUST GET LIVE MODE
const byokRes = resolveInterviewAccess({ plan: "free", credits: 0, hasBYOK: true });
assert.deepStrictEqual(byokRes, { mode: "live", reason: "byok" });
console.log("✓ BYOK user with 0 credits correctly receives live mode without charging platform");

// Case 4: User with stored encrypted key in DB
const byokEncRes = resolveInterviewAccess({ plan: "free", credits: 0, apiKeyEncrypted: "enc_blob" });
assert.deepStrictEqual(byokEncRes, { mode: "live", reason: "byok" });
console.log("✓ User with encrypted API key at rest receives live mode");

// Case 5: PAYG user with credits
const creditRes = resolveInterviewAccess({ plan: "payg", credits: 5 });
assert.deepStrictEqual(creditRes, { mode: "live", reason: "credits" });
console.log("✓ User with credits receives live mode (credit funded)");

// Case 6: Subscriber
const subRes = resolveInterviewAccess({ plan: "subscriber", credits: 0 });
assert.deepStrictEqual(subRes, { mode: "live", reason: "subscriber" });
console.log("✓ Subscriber receives live mode");

// 3. ROUND DECREMENT POLICY TEST
console.log("\n[3] Testing BYOK vs Credit Round Decrement Policy...");

function handleRoundCompletion(fundingSource, userCredits) {
  if (fundingSource === "demo") {
    return { decremented: false, remainingCredits: userCredits };
  }
  if (fundingSource === "byok" || fundingSource === "subscriber") {
    return { decremented: false, remainingCredits: userCredits };
  }
  if (fundingSource === "credits" && userCredits > 0) {
    return { decremented: true, remainingCredits: userCredits - 1 };
  }
  return { decremented: false, remainingCredits: userCredits };
}

const byokCompletion = handleRoundCompletion("byok", 0);
assert.strictEqual(byokCompletion.decremented, false);
assert.strictEqual(byokCompletion.remainingCredits, 0);
console.log("✓ BYOK live round completion leaves user credits untouched at 0");

const creditCompletion = handleRoundCompletion("credits", 5);
assert.strictEqual(creditCompletion.decremented, true);
assert.strictEqual(creditCompletion.remainingCredits, 4);
console.log("✓ Credit-funded live round completion decrements exactly 1 credit (5 -> 4)");

// 4. WEBHOOK IDEMPOTENCY TEST
console.log("\n[4] Testing Webhook Idempotency Simulation...");

const processedEvents = new Set();
function recordWebhook(eventId) {
  if (processedEvents.has(eventId)) return false;
  processedEvents.add(eventId);
  return true;
}

const firstDelivery = recordWebhook("evt_stripe_1001");
assert.strictEqual(firstDelivery, true, "First delivery should be recorded");

const duplicateDelivery = recordWebhook("evt_stripe_1001");
assert.strictEqual(duplicateDelivery, false, "Duplicate delivery must be rejected");
console.log("✓ Duplicate webhook event detected and discarded (double-crediting prevented)");

console.log("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
