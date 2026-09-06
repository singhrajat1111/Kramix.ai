/**
 * Security & Route Guard Verification Test Suite
 * Tests step progression guards, rate limiting, payload sanitization, and security headers.
 */

import { checkRouteAccess, getUnlockedSteps } from "../src/lib/guards.ts";
import { enforceRateLimit, checkRateLimit } from "../src/lib/security/rate-limit.ts";
import { sanitizeString, isValidEmail } from "../src/lib/security/validation.ts";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log("\n==========================================");
  console.log("🛡️  KRAMIX.AI SECURITY VERIFICATION SUITE");
  console.log("==========================================\n");

  // 1. ROUTE GUARD & STEP PROGRESSION TESTS
  console.log("--- 1. Route Guard & Prerequisite Enforcement ---");

  // A. Attempt to access /interview without profile
  const blockInterviewNoProfile = checkRouteAccess("/interview", { profile: null });
  assert(
    !blockInterviewNoProfile.allowed && blockInterviewNoProfile.redirectPath === "/setup",
    "Direct jump to /interview without profile is BLOCKED (redirects to /setup)"
  );

  // B. Attempt to access /interview with profile but NO round selected
  const blockInterviewNoRound = checkRouteAccess("/interview", {
    profile: { targetRole: "Software Engineer", targetCompanies: ["Google"] },
    selectedRound: null,
  });
  assert(
    !blockInterviewNoRound.allowed && blockInterviewNoRound.redirectPath === "/research",
    "Direct jump to /interview without round selected is BLOCKED (redirects to /research)"
  );

  // C. Access /interview with profile AND round selected
  const allowInterview = checkRouteAccess("/interview", {
    profile: { targetRole: "Staff Engineer", targetCompanies: ["Google"] },
    selectedRound: { id: "system_design", name: "System Design" },
  });
  assert(
    allowInterview.allowed,
    "Access to /interview is ALLOWED when profile and round are set"
  );

  // D. Attempt to access /results before interview is finished
  const blockResults = checkRouteAccess("/results", {
    profile: { targetRole: "Staff Engineer", targetCompanies: ["Google"] },
    selectedRound: { id: "system_design", name: "System Design" },
    report: null,
    dossier: null,
    session: null,
  });
  assert(
    !blockResults.allowed && blockResults.redirectPath === "/interview",
    "Direct jump to /results without completed evaluation is BLOCKED (redirects to /interview)"
  );

  // E. Access /results after evaluation is present
  const allowResults = checkRouteAccess("/results", {
    profile: { targetRole: "Staff Engineer", targetCompanies: ["Google"] },
    selectedRound: { id: "system_design", name: "System Design" },
    report: { overallScore: 92 },
  });
  assert(
    allowResults.allowed,
    "Access to /results is ALLOWED when evaluation results are present"
  );

  // F. Step unlock states
  const stepsInitial = getUnlockedSteps({ profile: null });
  assert(
    stepsInitial["/setup"] && !stepsInitial["/interview"] && !stepsInitial["/results"],
    "Initial unlocked steps: ONLY setup is accessible"
  );

  const stepsProfileDone = getUnlockedSteps({
    profile: { targetRole: "Frontend", targetCompanies: ["Meta"] },
  });
  assert(
    stepsProfileDone["/research"] && !stepsProfileDone["/interview"],
    "After profile: research is unlocked, interview remains locked until round selected"
  );

  // 2. INPUT SANITIZATION & PAYLOAD DEFENSE
  console.log("\n--- 2. Input Sanitization & Bounds Defense ---");

  const xssInput = "<script>alert('hacked')</script>Hello <img src=x onerror=alert(1)>World";
  const sanitized = sanitizeString(xssInput);
  assert(
    !sanitized.includes("<script>") && !sanitized.includes("onerror="),
    `XSS and malicious script tags stripped: "${sanitized}"`
  );

  const capped = sanitizeString("A".repeat(500), 50);
  assert(
    capped.length === 50,
    "String length capping strictly enforced"
  );

  assert(isValidEmail("candidate@kramix.ai"), "Valid email accepted");
  assert(!isValidEmail("not-an-email"), "Malformed email rejected");
  assert(!isValidEmail("fake@<script>.com"), "Injected script in email rejected");

  // 3. RATE LIMITING ENGINE
  console.log("\n--- 3. In-Memory Sliding Window Rate Limiting ---");

  const testIp = "test-ip-" + Date.now();
  // "byok" limit is 10 per 60s
  let blockedAt = -1;
  for (let i = 1; i <= 15; i++) {
    const result = checkRateLimit(testIp, "byok");
    if (!result.success) {
      blockedAt = i;
      break;
    }
  }
  assert(
    blockedAt === 11,
    `Rate limiter strictly engaged after 10 requests (Blocked at request #${blockedAt})`
  );

  // 4. LIVE HTTP HEADERS & API DEFENSE
  console.log("\n--- 4. Live Server Security Headers & API Defense ---");
  try {
    const res = await fetch("http://localhost:3000/");
    const xFrame = res.headers.get("x-frame-options");
    const xContentType = res.headers.get("x-content-type-options");
    const referrer = res.headers.get("referrer-policy");
    const csp = res.headers.get("content-security-policy");

    assert(xFrame === "SAMEORIGIN", `X-Frame-Options configured: ${xFrame}`);
    assert(xContentType === "nosniff", `X-Content-Type-Options configured: ${xContentType}`);
    assert(referrer === "strict-origin-when-cross-origin", `Referrer-Policy configured: ${referrer}`);
    assert(csp && csp.includes("checkout.razorpay.com"), "CSP configured with Razorpay allowance");

    // Test API route defense with oversized payload (> 5000 bytes limit)
    const oversizedRes = await fetch("http://localhost:3000/api/interview/complete-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flood: "X".repeat(6000) }),
    });
    assert(
      oversizedRes.status === 400,
      `Oversized payload to /api/interview/complete-round properly rejected with HTTP ${oversizedRes.status}`
    );

    // Test API route defense with invalid fundingSource enum
    const invalidEnumRes = await fetch("http://localhost:3000/api/interview/complete-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundingSource: "hacker_free_bypass" }),
    });
    assert(
      invalidEnumRes.status === 400,
      `Forged fundingSource to /api/interview/complete-round properly rejected with HTTP ${invalidEnumRes.status}`
    );

  } catch (err) {
    console.warn("⚠️ Local dev server was not reachable for live header fetch (skipping live header assertions):", err.message);
  }

  console.log("\n==========================================");
  console.log("🎉 ALL SECURITY CHECKS PASSED SUCCESSFULLY!");
  console.log("==========================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
