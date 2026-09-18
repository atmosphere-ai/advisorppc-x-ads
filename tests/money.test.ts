import assert from "node:assert/strict";
import { test } from "node:test";
import { MICRO, formatMoney, fromMicro, toMicro } from "../src/ads/money.ts";

test("micro conversion", () => {
  assert.equal(toMicro(50), 50 * MICRO);
  assert.equal(fromMicro(50_000_000), 50);
  assert.equal(fromMicro(null), null);
  assert.match(formatMoney(50_000_000, "USD"), /\$50/);
});
