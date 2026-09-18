import assert from "node:assert/strict";
import { test } from "node:test";
import { AdsClient } from "../src/ads/client.ts";
import { AdsApiError, ConfigError } from "../src/ads/errors.ts";

test("refuses empty token", () => {
  assert.throws(() => new AdsClient({ accessToken: "" }), ConfigError);
});

test("GET encodes query and parses JSON", async () => {
  const calls: string[] = [];
  const client = new AdsClient({
    accessToken: "tok",
    fetchImpl: async (url, init) => {
      calls.push(`${init?.method} ${url}`);
      return new Response(JSON.stringify({ data: [{ id: "18ce" }] }), { status: 200 });
    },
  });
  const out = await client.get<{ data: { id: string }[] }>("/12/accounts", { count: 2 });
  assert.equal(out.data[0].id, "18ce");
  assert.match(calls[0], /GET https:\/\/ads-api\.x.com\/12\/accounts\?count=2/);
});

test("non-2xx becomes AdsApiError", async () => {
  const client = new AdsClient({
    accessToken: "tok",
    fetchImpl: async () =>
      new Response(JSON.stringify({ errors: [{ message: "nope" }] }), { status: 401 }),
  });
  await assert.rejects(() => client.get("/12/accounts"), AdsApiError);
});
