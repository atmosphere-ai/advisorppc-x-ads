import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { DEFAULT_SETTINGS, type AgentDef, type AgentState, type Job, type JobStoreFile, type RunLog, type SchedulerSettings } from "./types.js";

export function defaultJobsPath(serverName: string): string {
  return process.env.ADVISORPPC_JOBS_PATH || join(homedir(), ".advisorppc", "jobs", `${serverName}.json`);
}

function emptyStore(agents: AgentDef[]): JobStoreFile {
  const map: Record<string, AgentState> = {};
  for (const a of agents) {
    map[a.id] = { id: a.id, enabled: false, every_ms: a.default_every_ms, settings: {} };
  }
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, jobs: [], agents: map, runs: [] };
}

export class JobStore {
  readonly path: string;
  private readonly catalog: AgentDef[];

  constructor(path: string, catalog: AgentDef[]) {
    this.path = path;
    this.catalog = catalog;
  }

  load(): JobStoreFile {
    if (!existsSync(this.path)) return emptyStore(this.catalog);
    const raw = JSON.parse(readFileSync(this.path, "utf8")) as JobStoreFile;
    if (!raw || raw.version !== 1) return emptyStore(this.catalog);
    raw.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
    if (!raw.settings.webhook_url && process.env.ADVISORPPC_WEBHOOK_URL) {
      raw.settings.webhook_url = process.env.ADVISORPPC_WEBHOOK_URL;
    }
    raw.jobs = Array.isArray(raw.jobs) ? raw.jobs : [];
    raw.runs = Array.isArray(raw.runs) ? raw.runs : [];
    raw.agents = raw.agents && typeof raw.agents === "object" ? raw.agents : {};
    for (const a of this.catalog) {
      if (!raw.agents[a.id]) {
        raw.agents[a.id] = { id: a.id, enabled: false, every_ms: a.default_every_ms, settings: {} };
      }
    }
    return raw;
  }

  save(file: JobStoreFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(file, null, 2), "utf8");
    renameSync(tmp, this.path);
  }

  mutate<T>(fn: (file: JobStoreFile) => T): T {
    const file = this.load();
    const out = fn(file);
    this.save(file);
    return out;
  }

  addJob(job: Omit<Job, "id" | "created_at" | "updated_at" | "run_count" | "status"> & { status?: Job["status"] }): Job {
    return this.mutate((file) => {
      const now = new Date().toISOString();
      const row: Job = {
        ...job,
        id: randomUUID(),
        status: job.status ?? "scheduled",
        created_at: now,
        updated_at: now,
        run_count: 0,
        confirm: true,
      };
      file.jobs.unshift(row);
      return row;
    });
  }

  getJob(id: string): Job | undefined {
    return this.load().jobs.find((j) => j.id === id);
  }

  patchJob(id: string, patch: Partial<Job>): Job {
    return this.mutate((file) => {
      const row = file.jobs.find((j) => j.id === id);
      if (!row) throw new Error(`unknown job ${id}`);
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return row;
    });
  }

  log(run: RunLog, keep = 200): void {
    this.mutate((file) => {
      file.runs.unshift(run);
      file.runs = file.runs.slice(0, keep);
    });
  }

  patchSettings(patch: Partial<SchedulerSettings>): SchedulerSettings {
    return this.mutate((file) => {
      file.settings = { ...file.settings, ...patch };
      return file.settings;
    });
  }

  setAgent(id: string, patch: Partial<AgentState>): AgentState {
    const def = this.catalog.find((a) => a.id === id);
    if (!def) throw new Error(`unknown agent ${id}`);
    return this.mutate((file) => {
      const cur = file.agents[id] ?? { id, enabled: false, every_ms: def.default_every_ms, settings: {} };
      const next: AgentState = {
        ...cur,
        ...patch,
        id,
        settings: { ...cur.settings, ...(patch.settings ?? {}) },
      };
      if (next.every_ms < def.min_every_ms) next.every_ms = def.min_every_ms;
      file.agents[id] = next;
      return next;
    });
  }
}

export function newJobId(): string {
  return randomUUID();
}
