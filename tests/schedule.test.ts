import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { nextCronAfter, parseCron, cronMatches } from "../src/schedule/cron.ts";
import { JobStore } from "../src/schedule/store.ts";
import { nextJobState, runDue } from "../src/schedule/worker.ts";
import { ADS_AGENTS, ADS_ALLOWLIST } from "../src/schedule/catalog.ts";
import { vendorSnippets } from "../src/schedule/setup.ts";
import type { Job } from "../src/schedule/types.ts";

test("parses 5-field cron weekdays 9:00", () => {
  const c = parseCron("0 9 * * 1-5");
  assert.ok(c.minute.has(0) && c.hour.has(9) && c.weekday.has(1) && c.weekday.has(5));
  assert.equal(c.weekday.has(0), false);
});

test("cronMatches UTC minute", () => {
  const c = parseCron("15 * * * *");
  const d = new Date("2026-09-18T12:15:00Z");
  assert.equal(cronMatches(d, c, "UTC"), true);
  assert.equal(cronMatches(new Date("2026-09-18T12:16:00Z"), c, "UTC"), false);
});

test("nextCronAfter is strictly in the future", () => {
  const from = new Date("2026-09-18T08:00:00Z");
  const next = nextCronAfter(from, "0 9 * * *", "UTC");
  assert.equal(next.toISOString(), "2026-09-18T09:00:00.000Z");
});

test("store persists jobs atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "ap-ads-jobs-"));
  try {
    const store = new JobStore(join(dir, "x.json"), ADS_AGENTS);
    const job = store.addJob({
      kind: "once",
      run_at: "2026-09-19T12:00:00.000Z",
      timezone: "UTC",
      action: {
        tool: "x_ads_set_status",
        arguments: { account_id: "18ce", entity: "CAMPAIGN", entity_id: "a", status: "PAUSED" },
      },
      confirm: true,
    });
    assert.equal(store.getJob(job.id)?.action.arguments.status, "PAUSED");
    store.patchJob(job.id, { status: "cancelled" });
    assert.equal(store.getJob(job.id)?.status, "cancelled");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runDue fires a due once job and marks done", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ap-ads-jobs-"));
  try {
    const store = new JobStore(join(dir, "x.json"), ADS_AGENTS);
    store.setAgent("publish_queue", { enabled: true });
    const job = store.addJob({
      kind: "once",
      run_at: "2020-01-01T00:00:00.000Z",
      timezone: "UTC",
      action: {
        tool: "x_ads_set_status",
        arguments: { account_id: "18ce", entity: "CAMPAIGN", entity_id: "a", status: "ACTIVE" },
      },
      confirm: true,
    });
    const fired: string[] = [];
    await runDue({
      store,
      catalog: ADS_AGENTS,
      executeJob: async (j) => {
        fired.push(j.id);
        return { ok: true, detail: "paused" };
      },
      runAgent: async () => ({ ok: true, detail: "skip" }),
      now: () => new Date("2026-09-18T00:00:00Z"),
    });
    assert.deepEqual(fired, [job.id]);
    assert.equal(store.getJob(job.id)?.status, "done");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publish_queue disabled holds writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ap-ads-jobs-"));
  try {
    const store = new JobStore(join(dir, "x.json"), ADS_AGENTS);
    store.setAgent("publish_queue", { enabled: false });
    store.addJob({
      kind: "once",
      run_at: "2020-01-01T00:00:00.000Z",
      timezone: "UTC",
      action: {
        tool: "x_ads_set_status",
        arguments: { account_id: "18ce", entity: "CAMPAIGN", entity_id: "a", status: "ACTIVE" },
      },
      confirm: true,
    });
    let fired = 0;
    await runDue({
      store,
      catalog: ADS_AGENTS,
      executeJob: async () => {
        fired += 1;
        return { ok: true, detail: "nope" };
      },
      runAgent: async () => ({ ok: true, detail: "skip" }),
      now: () => new Date("2026-09-18T00:00:00Z"),
    });
    assert.equal(fired, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nextJobState rolls every/cron and completes once", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  const base = {
    id: "j",
    kind: "once" as const,
    status: "running" as const,
    run_at: now.toISOString(),
    timezone: "UTC",
    action: { tool: "x_ads_set_status", arguments: {} },
    confirm: true as const,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    run_count: 0,
  } satisfies Job;
  assert.equal(nextJobState(base, now, true).status, "done");
  const every = nextJobState({ ...base, kind: "every", every_ms: 60_000 }, now, true);
  assert.equal(every.status, "scheduled");
  assert.equal(every.run_at, "2026-09-18T12:01:00.000Z");
});

test("allowlist is status/update/delete only", () => {
  assert.equal(ADS_ALLOWLIST.has("x_ads_set_status"), true);
  assert.equal(ADS_ALLOWLIST.has("x_ads_create_campaign"), false);
  assert.equal(ADS_ALLOWLIST.has("x_ads_create_image_ad"), false);
});

test("vendor snippets include claude, chatgpt, grok, advisorppc", () => {
  const s = vendorSnippets({
    server: "advisorppc-x-ads",
    command: "node",
    args: ["dist/index.js"],
    envTokenName: "X_ADS_ACCESS_TOKEN",
    jobsPath: "/tmp/jobs.json",
    workerRunning: true,
    publicUrl: "https://mcp.example/mcp",
  });
  assert.ok((s.claude as { mcpServers: unknown }).mcpServers);
  assert.equal((s.chatgpt as { url: string }).url, "https://mcp.example/mcp");
  assert.match(JSON.stringify(s.grok), /X_ADS_ACCESS_TOKEN/);
  assert.match(JSON.stringify(s.advisorppc_backend), /@advisorppc\/x-ads\/schedule/);
});
