export type JobKind = "once" | "every" | "cron";
export type JobStatus = "scheduled" | "paused" | "running" | "done" | "failed" | "cancelled";

export type JobAction = {
  tool: string;
  arguments: Record<string, unknown>;
};

export type Job = {
  id: string;
  name?: string;
  kind: JobKind;
  status: JobStatus;
  run_at: string;
  every_ms?: number;
  cron?: string;
  timezone: string;
  action: JobAction;
  agent?: string;
  confirm: true;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  last_error?: string;
  run_count: number;
  max_runs?: number;
};

export type AgentId = string;

export type AgentDef = {
  id: AgentId;
  title: string;
  description: string;
  default_every_ms: number;
  min_every_ms: number;
  /** If true, enabling requires confirm=true (live fire / spend / publish). */
  live: boolean;
  /** Digest agents never invent copy or auto-reply; they snapshot + optional webhook. */
  digest?: boolean;
};

export type AgentState = {
  id: AgentId;
  enabled: boolean;
  every_ms: number;
  last_run_at?: string;
  last_error?: string;
  settings: Record<string, unknown>;
};

export type SchedulerSettings = {
  timezone: string;
  webhook_url?: string;
  tick_ms: number;
  public_url?: string;
};

export type RunLog = {
  at: string;
  job_id?: string;
  agent_id?: string;
  ok: boolean;
  detail: string;
};

export type JobStoreFile = {
  version: 1;
  settings: SchedulerSettings;
  jobs: Job[];
  agents: Record<string, AgentState>;
  runs: RunLog[];
};

export const DEFAULT_SETTINGS: SchedulerSettings = {
  timezone: "UTC",
  tick_ms: 15_000,
};

export type ExecuteResult = { ok: boolean; detail: string; payload?: unknown };
