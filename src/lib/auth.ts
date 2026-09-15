/**
 * Shared-passcode access control.
 *
 * PKRTrackr is account-free: a poker group shares one passcode. A successful
 * unlock issues an HMAC-signed, expiring cookie. The signing key is derived
 * from AUTH_SECRET *and* the passcode, so changing APP_PASSCODE signs everyone
 * out. Uses Web Crypto only, so it runs identically in the proxy and in
 * Server Actions.
 */

export const SESSION_COOKIE = "pkrtrackr-session";
export const SESSION_DAYS = 30;

export type AuthMode = "open" | "passcode" | "misconfigured";

export function authMode(): AuthMode {
  if (process.env.APP_PASSCODE) return "passcode";
  // Never serve an unprotected money ledger from a production build by accident.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_OPEN_ACCESS !== "true") {
    return "misconfigured";
  }
  return "open";
}

const encoder = new TextEncoder();

async function signingKey() {
  const material = `${process.env.AUTH_SECRET ?? ""}::${process.env.APP_PASSCODE ?? ""}`;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(payload: string) {
  return toHex(await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload)));
}

/** Length-independent comparison so response timing reveals nothing about a guess. */
export function safeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()) {
  const expires = String(now + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${expires}.${await sign(expires)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()) {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < now) return false;
  return safeEqual(signature, await sign(expires));
}

export function passcodeMatches(attempt: string) {
  const expected = process.env.APP_PASSCODE;
  return Boolean(expected) && safeEqual(attempt, expected ?? "");
}

/** Only allow same-site relative redirects after unlocking. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/unlock")) return "/";
  return value;
}
