import { createHash } from "node:crypto";

export type IdentifierKind = "email" | "handle" | "phone" | "twitter_id" | "device_id";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

/** Strip to digits (E.164 without plus) before hashing. */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d]/g, "");
}

export function hashIdentifier(kind: IdentifierKind, raw: string, alreadyHashed = false): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${kind} value is empty`);
  if (alreadyHashed) return trimmed.toLowerCase();
  let normalized = trimmed;
  if (kind === "email") normalized = normalizeEmail(trimmed);
  else if (kind === "handle") normalized = normalizeHandle(trimmed);
  else if (kind === "phone") normalized = normalizePhone(trimmed);
  else normalized = trimmed;
  return sha256Hex(normalized);
}

export type RawUser = {
  email?: string | string[];
  phone?: string | string[];
  phone_number?: string | string[];
  handle?: string | string[];
  twitter_id?: string | string[];
  device_id?: string | string[];
};

function asList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
}

/** Hash a user record for Custom Audiences / DNR. Never log the raw values. */
export function hashUser(user: RawUser, alreadyHashed = false): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const email = asList(user.email).map((v) => hashIdentifier("email", v, alreadyHashed));
  const phone = [...asList(user.phone), ...asList(user.phone_number)].map((v) =>
    hashIdentifier("phone", v, alreadyHashed),
  );
  const handle = asList(user.handle).map((v) => hashIdentifier("handle", v, alreadyHashed));
  const twitter_id = asList(user.twitter_id).map((v) => hashIdentifier("twitter_id", v, alreadyHashed));
  const device_id = asList(user.device_id).map((v) => hashIdentifier("device_id", v, alreadyHashed));
  if (email.length) out.email = email;
  if (phone.length) out.phone_number = phone;
  if (handle.length) out.handle = handle;
  if (twitter_id.length) out.twitter_id = twitter_id;
  if (device_id.length) out.device_id = device_id;
  return out;
}
