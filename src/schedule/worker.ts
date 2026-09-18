import { nextCronAfter, nextEvery } from "./cron.js";
import type { JobStore } from "./store.js";
import type { AgentDef, ExecuteResult, Job } from "./types.js";

export type Executor = (job: Job) => Promise<ExecuteResult>;
export type AgentRunner = (agentId: string, settings: Record<string, unknown>) => Promise<ExecuteResult>;

export type WorkerOptions = {
  store: JobStore;
  catalog: AgentDef[];
  executeJob: Executor;
  runAgent: AgentRunner;
  now?: () => Date;
  tickMs?: number;
};

export type WorkerHandle = {
  stop: () => void;
  tick: () => Promise<void>;
  running: () => boolean;
};

const handles = new Map<string, WorkerHandle>();

export function getWorker(key: string): WorkerHandle | undefined {
  return handles.get(key);
}

export function startWorker(key: string, opts: WorkerOptions): WorkerHandle {
  const existing = handles.get(key);
  if (existing?.running()) return existing;
  existing?.stop();

  let timer: ReturnType<typeof setInterval> | undefined;
  let alive = true;
  let ticking = false;

  const tick = async () => {
    if (!alive || ticking) return;
    ticking = true;
    try {
      await runDue(opts);
    } catch (err) {
      console.error("[advisorppc-scheduler]", err);
    } finally {
      ticking = false;
    }
  };

  const handle: WorkerHandle = {
    stop: () => {
      alive = false;
      if (timer) clearInterval(timer);
      timer = undefined;
      handles.delete(key);
    },
    tick,
    running: () => alive && timer !== undefined,
  };

  const ms = Math.max(5_000, opts.tickMs ?? opts.store.load().settings.tick_ms ?? 15_000);
  timer = setInterval(() => {
    void tick();
  }, ms);
  handles.set(key, handle);
  void tick();
  return handle;
}

export async function runDue(opts: WorkerOptions): Promise<void> {
  const now = opts.now?.() ?? new Date();
  const iso = now.toISOString();
  const file = opts.store.load();
  // Master switch: if catalog has publish_queue and it is explicitly false, hold writes.
  const holdWrites =
    opts.catalog.some((a) => a.id === "publish_queue") && file.agents.publish_queue?.enabled === false;

  for (const job of file.jobs) {
    if (job.status !== "scheduled") continue;
    if (job.run_at > iso) continue;
    if (holdWrites) continue;
    await fireJob(opts, job.id, now);
  }

  for (const def of opts.catalog) {
    if (def.id === "publish_queue") continue;
    const st = file.agents[def.id];
    if (!st?.enabled) continue;
    const last = st.last_run_at ? Date.parse(st.last_run_at) : 0;
    if (now.getTime() - last < st.every_ms) continue;
    await fireAgent(opts, def.id, now);
  }
}

async function fireJob(opts: WorkerOptions, id: string, now: Date): Promise<void> {
  const job = opts.store.patchJob(id, { status: "running" });
  try {
    const result = await opts.executeJob(job);
    const next = nextJobState(job, now, result.ok);
    opts.store.patchJob(id, {
      status: next.status,
      run_at: next.run_at,
      last_run_at: now.toISOString(),
      last_error: result.ok ? undefined : result.detail,
      run_count: job.run_count + 1,
    });
    opts.store.log({
      at: now.toISOString(),
      job_id: id,
      ok: result.ok,
      detail: result.detail.slice(0, 500),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    opts.store.patchJob(id, {
      status: "failed",
      last_run_at: now.toISOString(),
      last_error: msg,
      run_count: job.run_count + 1,
    });
    opts.store.log({ at: now.toISOString(), job_id: id, ok: false, detail: msg.slice(0, 500) });
  }
}

async function fireAgent(opts: WorkerOptions, id: string, now: Date): Promise<void> {
  const file = opts.store.load();
  const st = file.agents[id];
  try {
    const result = await opts.runAgent(id, st?.settings ?? {});
    opts.store.setAgent(id, {
      last_run_at: now.toISOString(),
      last_error: result.ok ? undefined : result.detail,
    });
    opts.store.log({ at: now.toISOString(), agent_id: id, ok: result.ok, detail: result.detail.slice(0, 500) });
    const webhook = file.settings.webhook_url;
    if (webhook && result.ok && result.payload !== undefined) {
      await postWebhook(webhook, { source: keyFromStore(opts), agent: id, at: now.toISOString(), data: result.payload });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    opts.store.setAgent(id, { last_run_at: now.toISOString(), last_error: msg });
    opts.store.log({ at: now.toISOString(), agent_id: id, ok: false, detail: msg.slice(0, 500) });
  }
}

function keyFromStore(opts: WorkerOptions): string {
  return opts.store.path;
}

export function nextJobState(job: Job, now: Date, ok: boolean): { status: Job["status"]; run_at: string } {
  if (!ok) return { status: "failed", run_at: job.run_at };
  const runs = job.run_count + 1;
  if (job.max_runs && runs >= job.max_runs) return { status: "done", run_at: job.run_at };
  if (job.kind === "once") return { status: "done", run_at: job.run_at };
  if (job.kind === "every" && job.every_ms) {
    return { status: "scheduled", run_at: nextEvery(now, job.every_ms).toISOString() };
  }
  if (job.kind === "cron" && job.cron) {
    return { status: "scheduled", run_at: nextCronAfter(now, job.cron, job.timezone).toISOString() };
  }
  return { status: "done", run_at: job.run_at };
}

async function postWebhook(url: string, body: unknown): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}
