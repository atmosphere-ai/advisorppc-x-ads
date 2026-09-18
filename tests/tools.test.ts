import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "../src/server.ts";
import { DASHBOARD_URI } from "../src/apps/register.ts";
import { TOOL_COUNT } from "../src/tools/register.ts";

type ToolBag = Record<string, { enabled?: boolean; _meta?: { ui?: { resourceUri?: string } } }>;

function registeredTools(server: ReturnType<typeof createServer>): ToolBag {
  return (server as unknown as { _registeredTools: ToolBag })._registeredTools;
}

test("registers 43 operator tools plus dashboard resource", () => {
  const server = createServer({ accessToken: "test-token" });
  const tools = registeredTools(server);
  const names = Object.keys(tools);
  assert.equal(TOOL_COUNT, 43);
  assert.equal(names.length, 43);
  assert.ok(names.every((n) => n.startsWith("x_ads_")));
  assert.ok(names.includes("x_ads_list_accounts"));
  assert.ok(names.includes("x_ads_create_image_ad"));
  assert.ok(names.includes("x_ads_create_video_ad"));
  assert.ok(names.includes("x_ads_list_pixels"));
  assert.ok(names.includes("x_ads_create_audience"));
  assert.ok(names.includes("x_ads_list_dnr"));
  assert.ok(names.includes("x_ads_dnr_users"));
  assert.ok(names.includes("x_ads_estimate_audience"));
  assert.equal(tools.x_ads_list_accounts._meta?.ui?.resourceUri, DASHBOARD_URI);
});
