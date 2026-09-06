import crypto from "crypto";

const DEFAULT_INSECURE_TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// 32-byte key derived from process.env.ENCRYPTION_SECRET
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret === DEFAULT_INSECURE_TEST_KEY || secret.length < 32) {
      throw new Error(
        "FATAL CONFIGURATION ERROR: ENCRYPTION_SECRET must be set to a secure unique 32-byte secret in production."
      );
    }
  }

  if (!secret) {
    // Non-production fallback for local development and test automation only
    return Buffer.from(DEFAULT_INSECURE_TEST_KEY, "hex");
  }

  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  // If provided as a string passphrase, derive a 32-byte key via SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts an API key using AES-256-GCM.
 * Output format: Base64 string containing [12-byte IV + 16-byte Auth Tag + Ciphertext].
 */
export function encryptApiKey(plain: string): string {
  if (!plain) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64");
}

/**
 * Decrypts an AES-256-GCM encrypted API key string.
 * Decrypted solely on the server inside API routes when dispatching to LLM providers.
 * Never logged or returned to the client.
 */
export function decryptApiKey(encryptedBase64: string): string {
  if (!encryptedBase64) return "";
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(encryptedBase64, "base64");
    if (buf.length < 28) {
      throw new Error("Invalid encrypted payload length");
    }
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    console.error("Failed to decrypt API key: authentication tag mismatch or corrupted payload");
    return "";
  }
}
