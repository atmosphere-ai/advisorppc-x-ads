import type { SchedulerSettings } from "./types.js";

export type Vendor = "claude" | "chatgpt" | "cursor" | "grok" | "http" | "advisorppc";

export type SetupContext = {
  server: string;
  command: string;
  args: string[];
  envTokenName: string;
  publicUrl?: string;
  jobsPath: string;
  workerRunning: boolean;
};

/** Ready-to-paste snippets so Claude / ChatGPT / Cursor / Grok / AdvisorPPC backend self-connect. */
export function vendorSnippets(ctx: SetupContext): Record<string, unknown> {
  const url = ctx.publicUrl || "http://127.0.0.1:3333/mcp";
  const env = { [ctx.envTokenName]: "YOUR_TOKEN", ADVISORPPC_JOBS_PATH: ctx.jobsPath, ADVISORPPC_SCHEDULER: "1" };
  return {
    note: "X API has no native schedule. This is AdvisorPPC's own queue. HTTP mode starts the worker by itself; stdio needs npm run worker or ADVISORPPC_SCHEDULER=1.",
    worker_running: ctx.workerRunning,
    jobs_path: ctx.jobsPath,
    mcp_url: url,
    claude: {
      mcpServers: {
        [ctx.server]: {
          command: ctx.command,
          args: ctx.args,
          env,
        },
      },
    },
    cursor: {
      mcpServers: {
        [ctx.server]: {
          command: ctx.command,
          args: ctx.args,
          env,
        },
      },
    },
    chatgpt: {
      url,
      authentication: "bearer",
      header: "Authorization: Bearer <token>",
      notes: "ChatGPT custom MCP / Actions: POST JSON-RPC to /mcp. The in-process worker fires jobs even when ChatGPT is not in a chat.",
    },
    grok: {
      toml: [
        `[mcp_servers.${ctx.server}]`,
        `command = ${JSON.stringify(ctx.command)}`,
        `args = ${JSON.stringify(ctx.args)}`,
        "",
        `[mcp_servers.${ctx.server}.env]`,
        `${ctx.envTokenName} = "…"`,
        `ADVISORPPC_JOBS_PATH = ${JSON.stringify(ctx.jobsPath)}`,
        `ADVISORPPC_SCHEDULER = "1"`,
      ].join("\n"),
    },
    advisorppc_backend: {
      import: `import { createScheduler } from "${ctx.server === "advisorppc-x-ads" ? "@advisorppc/x-ads/schedule" : "@advisorppc/x-organic/schedule"}"`,
      usage: [
        "const sched = createScheduler({ accessToken })",
        "sched.start() // in-process worker; persists to ADVISORPPC_JOBS_PATH",
        "app.use('/mcp', sched.httpHandler) // optional",
      ].join("\n"),
    },
    http: {
      health: "/health",
      scheduler: "/scheduler",
      mcp: "/mcp",
    },
  };
}

export function mergePublicUrl(settings: SchedulerSettings, publicUrl?: string): SchedulerSettings {
  if (!publicUrl) return settings;
  return { ...settings, public_url: publicUrl.replace(/\/$/, "") };
}
