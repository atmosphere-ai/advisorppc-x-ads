import { z } from "zod";
import type { AdsClient } from "../ads/client.js";
import { DASHBOARD_URI } from "../apps/register.js";

export type ClientFactory = () => AdsClient;

/** MCP Apps linkage (SEP-1865). Hosts that ignore Apps still get JSON. */
export const UI_META = { ui: { resourceUri: DASHBOARD_URI } } as const;

export function text(data: unknown) {
  const payload = data ?? null;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: (typeof payload === "object" && payload !== null ? payload : { result: payload }) as Record<
      string,
      unknown
    >,
    _meta: UI_META,
  };
}

export function dropEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

export const accountId = z.string().describe("Ads API account id from x_ads_list_accounts, e.g. 18ce55v2od2");
