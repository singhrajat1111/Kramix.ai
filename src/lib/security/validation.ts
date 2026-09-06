/**
 * Payload validation, bounds checking, and input sanitization utilities.
 * Protects endpoints from injection, XSS, payload flooding, and memory exhaust attacks.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates that an incoming request body string does not exceed maximum byte size.
 */
export function validateBodySize(rawText: string, maxBytes = 100_000): void {
  const byteLength = Buffer.byteLength(rawText, "utf8");
  if (byteLength > maxBytes) {
    throw new ValidationError(`Payload exceeds maximum allowed size (${byteLength} > ${maxBytes} bytes)`);
  }
}

/**
 * Sanitizes untrusted user inputs:
 * - Caps maximum string length
 * - Strips script tags, onerror/onclick event handlers, and javascript: protocols
 * - Strips null bytes and harmful control sequences
 */
export function sanitizeString(input: unknown, maxLength = 5000): string {
  if (typeof input !== "string") return "";
  let clean = input.slice(0, maxLength);

  // Strip null bytes
  clean = clean.replace(/\0/g, "");

  // Strip script tags and dangerous HTML attributes
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, "");
  clean = clean.replace(/javascript\s*:/gi, "");

  // Normalize control characters (preserve normal newlines and tabs)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return clean.trim();
}

/**
 * Validates email format strictly.
 */
export function validateEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new ValidationError("Email must be a string");
  }
  const clean = email.trim().toLowerCase();
  if (clean.length > 254) {
    throw new ValidationError("Email address too long");
  }
  // Standard RFC 5322 compatible regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    throw new ValidationError("Invalid email address format");
  }
  return clean;
}

export function isValidEmail(email: unknown): boolean {
  try {
    validateEmail(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely reads and validates JSON body from NextRequest.
 */
export async function readSafeJsonBody<T = Record<string, unknown>>(
  req: { text: () => Promise<string> },
  maxBytes = 100_000
): Promise<{ data?: T; error?: string }> {
  try {
    const raw = await req.text();
    const data = parseSafeJSON<T>(raw, maxBytes);
    return { data };
  } catch (err) {
    return { error: err instanceof ValidationError ? err.message : "Invalid JSON payload" };
  }
}

/**
 * Validates interview speech inputs from candidates.
 */
export function validateCandidateSpeech(speech: unknown, maxChars = 8000): string {
  if (speech === null || speech === undefined) return "";
  if (typeof speech !== "string") {
    throw new ValidationError("Candidate speech must be text");
  }
  return sanitizeString(speech, maxChars);
}

/**
 * Validates and safely parses JSON payloads.
 */
export function parseSafeJSON<T = Record<string, unknown>>(rawText: string, maxBytes = 100_000): T {
  validateBodySize(rawText, maxBytes);
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
      throw new ValidationError("Expected JSON object");
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Malformed JSON payload");
  }
}
