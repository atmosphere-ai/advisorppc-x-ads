import type { AgentDef } from "./types.js";

export const ADS_PREFIX = "x_ads";

/** Tools the worker is allowed to fire. Digests are agents, not raw tools. */
export const ADS_ALLOWLIST = new Set([
  "x_ads_set_status",
  "x_ads_update_campaign",
  "x_ads_update_ad_group",
  "x_ads_delete",
]);

export const ADS_AGENTS: AgentDef[] = [
  {
    id: "publish_queue",
    title: "Publish queue",
    description:
      "Fires due x_ads_schedule_create jobs (pause/resume/update/delete). Ids and statuses must already be on the job — the agent never invents entities or spend. Enable to process the queue on this process.",
    default_every_ms: 15_000,
    min_every_ms: 15_000,
    live: false,
  },
  {
    id: "analytics_digest",
    title: "Analytics digest",
    description:
      "Pulls last-24h campaign stats (ENGAGEMENT,BILLING) and stores a snapshot. Optional webhook for Claude/ChatGPT/AdvisorPPC. NEVER changes status or spend.",
    default_every_ms: 60 * 60_000,
    min_every_ms: 15 * 60_000,
    live: false,
    digest: true,
  },
  {
    id: "paused_audit",
    title: "Paused audit",
    description:
      "Lists PAUSED campaigns and ad groups so an operator can resume named ones. Optional webhook. NEVER auto-resumes.",
    default_every_ms: 6 * 60 * 60_000,
    min_every_ms: 60 * 60_000,
    live: false,
    digest: true,
  },
  {
    id: "health",
    title: "Token health",
    description: "Calls GET /12/accounts so a dead token shows up in scheduler status before a status change fires.",
    default_every_ms: 60 * 60_000,
    min_every_ms: 15 * 60_000,
    live: false,
    digest: true,
  },
];
