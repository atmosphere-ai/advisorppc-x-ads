import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { hashIdentifier, hashUser, normalizeEmail, normalizeHandle, normalizePhone } from "../src/ads/hash.ts";

test("normalizes email lowercase/trim", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
});

test("normalizes handle strip @", () => {
  assert.equal(normalizeHandle("@Acme"), "acme");
});

test("normalizes phone to digits", () => {
  assert.equal(normalizePhone("+1 (415) 555-0100"), "14155550100");
});

test("hashes email SHA-256 of normalized value", () => {
  const expected = createHash("sha256").update("foo@bar.com", "utf8").digest("hex");
  assert.equal(hashIdentifier("email", "  Foo@Bar.COM "), expected);
});

test("alreadyHashed skips re-hash", () => {
  const hex = "a".repeat(64);
  assert.equal(hashIdentifier("email", hex, true), hex);
});

test("hashUser maps emails and phones", () => {
  const row = hashUser({ email: "a@b.co", phone: "+1-202-555-0100" });
  assert.equal(row.email?.length, 1);
  assert.equal(row.phone_number?.length, 1);
  assert.match(row.email![0], /^[a-f0-9]{64}$/);
});
