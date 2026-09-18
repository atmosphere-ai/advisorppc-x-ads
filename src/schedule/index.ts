/**
 * AdvisorPPC scheduler module — import this from the AdvisorPPC backend
 * or any Node host. HTTP MCP auto-starts the worker; stdio does not
 * unless ADVISORPPC_SCHEDULER=1.
 *
 *   import { createScheduler } from "@advisorppc/x-ads/schedule"
 *   const s = createScheduler({ accessToken })
 *   s.start()
 */
import { homedir } from "node:os";
import { ADS_AGENTS, ADS_ALLOWLIST } from "./catalog.js";
import { executeAdsJob, runAdsAgent } from "./execute.js";
import { defaultJobsPath, JobStore } from "./store.js";
import { getWorker, startWorker, type WorkerHandle } from "./worker.js";
import { vendorSnippets, type SetupContext } from "./setup.js";
import type { AgentDef, JobStoreFile } from "./types.js";

export { JobStore, defaultJobsPath } from "./store.js";
export { parseCron, nextCronAfter, nextEvery, cronMatches } from "./cron.js";
export { startWorker, getWorker, runDue, nextJobState } from "./worker.js";
export { vendorSnippets } from "./setup.js";
export { ADS_AGENTS, ADS_ALLOWLIST, ADS_PREFIX } from "./catalog.js";
export { executeAdsJob, runAdsAgent } from "./execute.js";
export * from "./types.js";

const WORKER_KEY = "x-ads";
let singleton: Scheduler | undefined;

export type CreateSchedulerOptions = {
  accessToken?: string;
  jobsPath?: string;
  autoStart?: boolean;
};

export type Scheduler = {
  store: JobStore;
  catalog: AgentDef[];
  start: () => WorkerHandle;
  stop: () => void;
  status: () => {
    running: boolean;
    jobs_path: string;
    snapshot: JobStoreFile;
  };
  setupContext: (publicUrl?: string) => SetupContext;
};

export function schedulerEnabledByEnv(): boolean {
  return process.env.ADVISORPPC_SCHEDULER === "1";
}

export function createScheduler(opts: CreateSchedulerOptions = {}): Scheduler {
  const path = opts.jobsPath || defaultJobsPath("x-ads");
  const store = new JobStore(path, ADS_AGENTS);
  const token = opts.accessToken;

  const start = () =>
    startWorker(WORKER_KEY, {
      store,
      catalog: ADS_AGENTS,
      executeJob: (job) => executeAdsJob(job, token),
      runAgent: (id, settings) => runAdsAgent(id, settings, token),
      tickMs: store.load().settings.tick_ms,
    });

  const sched: Scheduler = {
    store,
    catalog: ADS_AGENTS,
    start,
    stop: () => getWorker(WORKER_KEY)?.stop(),
    status: () => ({
      running: Boolean(getWorker(WORKER_KEY)?.running()),
      jobs_path: path,
      snapshot: store.load(),
    }),
    setupContext: (publicUrl?: string) => ({
      server: "advisorppc-x-ads",
      command: "node",
      args: [`${process.cwd()}/dist/index.js`],
      envTokenName: "X_ADS_ACCESS_TOKEN",
      publicUrl: publicUrl || store.load().settings.public_url,
      jobsPath: path,
      workerRunning: Boolean(getWorker(WORKER_KEY)?.running()),
    }),
  };

  if (opts.autoStart || schedulerEnabledByEnv()) sched.start();
  return sched;
}

export function getScheduler(opts: CreateSchedulerOptions = {}): Scheduler {
  if (!singleton) singleton = createScheduler(opts);
  return singleton;
}

/** HTTP process: start the worker unless ADVISORPPC_SCHEDULER=0. */
export function ensureHttpWorker(accessToken?: string): Scheduler {
  const sched = getScheduler({ accessToken });
  if (process.env.ADVISORPPC_SCHEDULER !== "0") sched.start();
  return sched;
}

export function homedirJobsHint(): string {
  return `${homedir()}/.advisorppc/jobs`;
}

export function assertAllowlisted(tool: string): void {
  if (!ADS_ALLOWLIST.has(tool)) {
    throw new Error(`${tool} cannot be scheduled. Allowlist: ${[...ADS_ALLOWLIST].join(", ")}`);
  }
}

export function resetSchedulerForTests(): void {
  singleton?.stop();
  singleton = undefined;
}
