import assert from "node:assert/strict";
import { test } from "node:test";
import { PolicyError } from "../src/ads/errors.ts";
import { assertNamedMutation, normalizeCreateStatus } from "../src/policy/safety.ts";

test("creates default to PAUSED", () => {
  assert.equal(normalizeCreateStatus({}), "PAUSED");
  assert.equal(normalizeCreateStatus({ entity_status: "DRAFT" }), "DRAFT");
});

test("ACTIVE create without confirm_spend is refused", () => {
  assert.throws(
    () => normalizeCreateStatus({ entity_status: "ACTIVE" }),
    PolicyError,
  );
});

test("ACTIVE create with confirm_spend is allowed", () => {
  assert.equal(normalizeCreateStatus({ entity_status: "ACTIVE", confirm_spend: true }), "ACTIVE");
});

test("delete/pause without confirm is refused", () => {
  assert.throws(() => assertNamedMutation(undefined, "Deleting"), PolicyError);
  assert.doesNotThrow(() => assertNamedMutation(true, "Deleting"));
});
