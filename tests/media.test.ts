import assert from "node:assert/strict";
import { test } from "node:test";
import { CHUNK_BYTES, mediaCategory, uploadMedia } from "../src/ads/media.ts";

test("ads video uses amplify_video", () => {
  assert.equal(mediaCategory("video/mp4", true), "amplify_video");
  assert.equal(mediaCategory("video/mp4", false), "tweet_video");
  assert.equal(mediaCategory("image/png"), "tweet_image");
  assert.equal(mediaCategory("image/gif"), "tweet_gif");
});

test("simple image upload posts 1.1 multipart", async () => {
  const calls: { url: string; method?: string }[] = [];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const out = await uploadMedia({
    accessToken: "tok",
    body: png,
    mimeType: "image/png",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method });
      return new Response(JSON.stringify({ media_key: "3_99", media_id_string: "99" }), { status: 200 });
    },
  });
  assert.equal(out.media_key, "3_99");
  assert.match(calls[0].url, /upload\.twitter\.com\/1\.1\/media\/upload/);
});

test("video uses v2 INIT APPEND FINALIZE and polls STATUS", async () => {
  const ftyp = Buffer.alloc(12);
  ftyp.write("xxxxftyp", 0, "ascii");
  const video = Buffer.concat([ftyp, Buffer.alloc(CHUNK_BYTES + 100, 1)]);
  const calls: string[] = [];
  let statusHits = 0;
  const out = await uploadMedia({
    accessToken: "tok",
    body: video,
    mimeType: "video/mp4",
    sleep: async () => {},
    fetchImpl: async (url, init) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push(`${method} ${u}`);
      if (u.endsWith("/initialize")) {
        return new Response(JSON.stringify({ data: { id: "1880", media_key: "7_1880" } }), { status: 200 });
      }
      if (u.includes("/append")) return new Response("{}", { status: 200 });
      if (u.includes("/finalize")) {
        return new Response(
          JSON.stringify({ data: { media_key: "7_1880", processing_info: { state: "pending", check_after_secs: 1 } } }),
          { status: 200 },
        );
      }
      if (u.includes("command=STATUS")) {
        statusHits += 1;
        const state = statusHits >= 2 ? "succeeded" : "in_progress";
        return new Response(JSON.stringify({ data: { media_key: "7_1880", processing_info: { state } } }), {
          status: 200,
        });
      }
      return new Response("nope", { status: 404 });
    },
  });
  assert.equal(out.media_key, "7_1880");
  assert.equal(out.category, "amplify_video");
  assert.equal(calls.filter((c) => c.includes("/append")).length, 2);
  assert.ok(calls.some((c) => c.includes("/initialize")));
  assert.ok(calls.some((c) => c.includes("/finalize")));
  assert.ok(statusHits >= 2);
});
