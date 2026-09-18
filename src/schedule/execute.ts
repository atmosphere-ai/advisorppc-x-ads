import { AdsClient, tokenFromEnv } from "../ads/client.js";
import { PolicyError } from "../ads/errors.js";
import { ADS_ALLOWLIST } from "./catalog.js";
import type { ExecuteResult, Job } from "./types.js";

export function adsClient(accessToken?: string): AdsClient {
  return new AdsClient({ accessToken: accessToken || tokenFromEnv() });
}

export async function executeAdsJob(job: Job, accessToken?: string): Promise<ExecuteResult> {
  if (!ADS_ALLOWLIST.has(job.action.tool)) {
    throw new PolicyError(`Refusing to run ${job.action.tool} from the scheduler. Not on the allowlist.`);
  }
  const args = job.action.arguments;
  const ads = adsClient(accessToken);
  const account_id = requireAccount(args);

  switch (job.action.tool) {
    case "x_ads_set_status": {
      const entity = str(args.entity);
      const entity_id = str(args.entity_id);
      const status = str(args.status);
      if (!entity || !entity_id || !status) {
        throw new PolicyError("set_status needs entity, entity_id, and status the user named.");
      }
      if (entity !== "CAMPAIGN" && entity !== "LINE_ITEM") {
        throw new PolicyError("entity must be CAMPAIGN or LINE_ITEM");
      }
      if (status !== "ACTIVE" && status !== "PAUSED") {
        throw new PolicyError("status must be ACTIVE or PAUSED");
      }
      const path =
        entity === "CAMPAIGN"
          ? `/12/accounts/${account_id}/campaigns/${entity_id}`
          : `/12/accounts/${account_id}/line_items/${entity_id}`;
      const out = await ads.putForm(path, { entity_status: status });
      return { ok: true, detail: `${entity} ${entity_id} → ${status}`, payload: out };
    }
    case "x_ads_update_campaign": {
      const campaign_id = str(args.campaign_id);
      if (!campaign_id) throw new PolicyError("update_campaign needs campaign_id");
      const fields = dropEmpty({
        name: args.name,
        daily_budget_amount_local_micro: args.daily_budget_amount_local_micro,
        total_budget_amount_local_micro: args.total_budget_amount_local_micro,
      });
      if (!Object.keys(fields).length) throw new PolicyError("update_campaign needs a named field");
      const out = await ads.putForm(`/12/accounts/${account_id}/campaigns/${campaign_id}`, fields);
      return { ok: true, detail: `campaign ${campaign_id} updated`, payload: out };
    }
    case "x_ads_update_ad_group": {
      const line_item_id = str(args.line_item_id);
      if (!line_item_id) throw new PolicyError("update_ad_group needs line_item_id");
      const fields = dropEmpty({
        name: args.name,
        bid_amount_local_micro: args.bid_amount_local_micro,
        daily_budget_amount_local_micro: args.daily_budget_amount_local_micro,
        total_budget_amount_local_micro: args.total_budget_amount_local_micro,
      });
      if (!Object.keys(fields).length) throw new PolicyError("update_ad_group needs a named field");
      const out = await ads.putForm(`/12/accounts/${account_id}/line_items/${line_item_id}`, fields);
      return { ok: true, detail: `ad group ${line_item_id} updated`, payload: out };
    }
    case "x_ads_delete": {
      const entity = str(args.entity);
      const entity_id = str(args.entity_id);
      if (!entity || !entity_id) throw new PolicyError("delete needs entity and entity_id");
      const path =
        entity === "CAMPAIGN"
          ? `/12/accounts/${account_id}/campaigns/${entity_id}`
          : entity === "LINE_ITEM"
            ? `/12/accounts/${account_id}/line_items/${entity_id}`
            : entity === "PROMOTED_TWEET"
              ? `/12/accounts/${account_id}/promoted_tweets/${entity_id}`
              : "";
      if (!path) throw new PolicyError("entity must be CAMPAIGN, LINE_ITEM, or PROMOTED_TWEET");
      const out = await ads.delete(path);
      return { ok: true, detail: `deleted ${entity} ${entity_id}`, payload: out };
    }
    default:
      throw new PolicyError(`unhandled ${job.action.tool}`);
  }
}

export async function runAdsAgent(
  agentId: string,
  settings: Record<string, unknown>,
  accessToken?: string,
): Promise<ExecuteResult> {
  const ads = adsClient(accessToken);
  if (agentId === "publish_queue") {
    return { ok: true, detail: "queue drained by worker job loop" };
  }
  if (agentId === "health") {
    const page = await ads.get("/12/accounts");
    const count = Array.isArray((page as { data?: unknown[] }).data)
      ? (page as { data: unknown[] }).data.length
      : 0;
    return { ok: true, detail: `${count} accounts`, payload: page };
  }
  const account_id = optionalAccount(settings);
  if (agentId === "analytics_digest") {
    if (!account_id) {
      return { ok: false, detail: "analytics_digest needs account_id on the agent or X_ADS_ACCOUNT_ID" };
    }
    const window = hourWindow(24);
    const campaigns = (await ads.get(`/12/accounts/${account_id}/campaigns`, { count: 20 })) as {
      data?: Array<{ id?: string; name?: string; entity_status?: string }>;
    };
    const ids = (campaigns.data ?? []).map((c) => c.id).filter((id): id is string => Boolean(id)).slice(0, 20);
    if (!ids.length) {
      return { ok: true, detail: "no campaigns", payload: { account_id, ...window, campaigns: [] } };
    }
    const stats = await ads.get(`/12/stats/accounts/${account_id}`, {
      entity: "CAMPAIGN",
      entity_ids: ids.join(","),
      start_time: window.start_time,
      end_time: window.end_time,
      granularity: "TOTAL",
      metric_groups: "ENGAGEMENT,BILLING",
      placement: "ALL_ON_TWITTER",
    });
    return {
      ok: true,
      detail: `analytics ${ids.length} campaigns`,
      payload: { account_id, ...window, campaign_ids: ids, stats },
    };
  }
  if (agentId === "paused_audit") {
    if (!account_id) {
      return { ok: false, detail: "paused_audit needs account_id on the agent or X_ADS_ACCOUNT_ID" };
    }
    const campaigns = (await ads.get(`/12/accounts/${account_id}/campaigns`, { count: 200 })) as {
      data?: Array<{ id?: string; name?: string; entity_status?: string }>;
    };
    const groups = (await ads.get(`/12/accounts/${account_id}/line_items`, { count: 200 })) as {
      data?: Array<{ id?: string; name?: string; entity_status?: string; campaign_id?: string }>;
    };
    const pausedCampaigns = (campaigns.data ?? []).filter((r) => String(r.entity_status).toUpperCase() === "PAUSED");
    const pausedGroups = (groups.data ?? []).filter((r) => String(r.entity_status).toUpperCase() === "PAUSED");
    return {
      ok: true,
      detail: `${pausedCampaigns.length} paused campaigns, ${pausedGroups.length} paused groups`,
      payload: { account_id, pausedCampaigns, pausedGroups },
    };
  }
  return { ok: false, detail: `unknown agent ${agentId}` };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function requireAccount(args: Record<string, unknown>): string {
  const id = str(args.account_id) || process.env.X_ADS_ACCOUNT_ID;
  if (!id) throw new PolicyError("Need account_id on the job (or X_ADS_ACCOUNT_ID).");
  return id;
}

function optionalAccount(settings: Record<string, unknown>): string | undefined {
  return str(settings.account_id) || process.env.X_ADS_ACCOUNT_ID || undefined;
}

function dropEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/** Ads stats require whole-hour ISO-8601 windows ≤ 7 days. */
export function hourWindow(hours: number): { start_time: string; end_time: string } {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end.getTime() - hours * 3_600_000);
  return { start_time: isoHour(start), end_time: isoHour(end) };
}

function isoHour(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
