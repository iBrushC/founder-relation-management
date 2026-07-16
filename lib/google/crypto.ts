import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Envelope encryption for Google OAuth tokens at rest.
 *
 * `google_accounts` already denies the browser everything (RLS on, no policies),
 * so this guards a different threat: anyone holding a database dump, a leaked
 * `DATABASE_URL`, or a backup. Those grant the `postgres` role, which bypasses
 * RLS — without this, they would also grant every user's Gmail.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
 * than silently yielding garbage we'd send to Google as a token.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits — the GCM standard, and what Node optimizes for.
const KEY_BYTES = 32; // AES-256.

/** Cached so we don't re-parse/validate the key on every token read. */
let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY is not set (see .env.local). Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  const parsed = Buffer.from(raw, "base64");
  if (parsed.length !== KEY_BYTES) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes of base64 (got ${parsed.length}).`,
    );
  }

  cachedKey = parsed;
  return parsed;
}

/**
 * Encrypt a token for storage. Returns `v1.<iv>.<authTag>.<ciphertext>`, all
 * base64url — the `v1` prefix leaves room to rotate algorithm or key later
 * without having to guess at what old rows contain.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Reverse of `encryptToken`. Throws if the key is wrong or the value was tampered with. */
export function decryptToken(encoded: string): string {
  const [version, ivB64, tagB64, dataB64] = encoded.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored Google token is malformed.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Constant-time string compare, for the OAuth `state` check. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
