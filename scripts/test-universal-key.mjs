import assert from "node:assert";

// Helper duplicate for standalone test script
function detectProviderFromKey(apiKey) {
  if (!apiKey) return "gemini";
  const key = apiKey.trim();
  if (key.startsWith("AIza")) {
    return "gemini";
  }
  if (key.startsWith("sk-or-")) {
    return "openrouter";
  }
  if (key.startsWith("sk-")) {
    return "openai";
  }
  if (key.length >= 35 && !key.startsWith("sk-")) {
    return "gemini";
  }
  return "openai";
}

console.log("=== TESTING UNIVERSAL KEY DETECTION ===");

// 1. Google Gemini keys
assert.strictEqual(detectProviderFromKey("AIzaSyB-1234567890abcdefghijklmnopqrstuv"), "gemini");
assert.strictEqual(detectProviderFromKey("AIzaSyD-sample-gemini-key"), "gemini");
console.log("✓ Google Gemini key detection passed");

// 2. OpenAI keys
assert.strictEqual(detectProviderFromKey("sk-proj-1234567890abcdefg"), "openai");
assert.strictEqual(detectProviderFromKey("sk-1234567890abcdefghijkl"), "openai");
console.log("✓ OpenAI key detection passed");

// 3. OpenRouter keys
assert.strictEqual(detectProviderFromKey("sk-or-v1-abcdef1234567890"), "openrouter");
assert.strictEqual(detectProviderFromKey("sk-or-test-sample-key"), "openrouter");
console.log("✓ OpenRouter key detection passed");

// 4. Default / Fallback
assert.strictEqual(detectProviderFromKey(""), "gemini");
assert.strictEqual(detectProviderFromKey(undefined), "gemini");
console.log("✓ Fallback behavior passed");

console.log("=== ALL KEY DETECTION TESTS PASSED! ===");
