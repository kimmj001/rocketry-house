import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCOUNT_STATUS_COOKIE_NAME = "rh-account-status-session";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_PASSWORD = "6656";

function configuredPassword() {
  return process.env.ACCOUNT_STATUS_PASSWORD ?? DEFAULT_PASSWORD;
}

function sessionSecret() {
  return process.env.ACCOUNT_STATUS_SECRET ?? process.env.NEXTAUTH_SECRET ?? "rocketry-house-account-status-session";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function verifyAccountStatusPassword(password: string) {
  return safeEqual(password.trim(), configuredPassword());
}

export function createAccountStatusSession() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `account-status:${expiresAt}`;
  return `${expiresAt}.${sign(payload)}`;
}

export function isAccountStatusSessionValid(token?: string) {
  if (!token) return false;

  const [expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || !signature || expiresAt <= Date.now()) return false;

  const expectedSignature = sign(`account-status:${expiresAt}`);
  return safeEqual(signature, expectedSignature);
}
