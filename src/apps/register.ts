import type { McpServer } from "@modelcontextprotocol/server";
import { DASHBOARD_HTML } from "./dashboard.js";
import { SCHEDULER_HTML } from "./scheduler.js";

export const DASHBOARD_URI = "ui://advisorppc/x-ads/dashboard";
export const SCHEDULER_URI = "ui://advisorppc/x-ads/scheduler";

const UI_RESOURCE_META = {
  ui: {
    prefersBorder: true,
    csp: {
      connectDomains: [] as string[],
      resourceDomains: [] as string[],
    },
  },
};

export function registerApps(server: McpServer): void {
  server.registerResource(
    "x-ads-dashboard",
    DASHBOARD_URI,
    {
      title: "X Ads dashboard",
      description: "Inline table of campaigns / ad groups / ads from the last tool result.",
      mimeType: "text/html;profile=mcp-app",
      _meta: UI_RESOURCE_META,
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_URI,
          mimeType: "text/html;profile=mcp-app",
          text: DASHBOARD_HTML,
          _meta: UI_RESOURCE_META,
        },
      ],
    }),
  );

  server.registerResource(
    "x-ads-scheduler",
    SCHEDULER_URI,
    {
      title: "X Ads scheduler",
      description: "AdvisorPPC job queue, agents, and vendor setup (Claude / ChatGPT / Grok).",
      mimeType: "text/html;profile=mcp-app",
      _meta: UI_RESOURCE_META,
    },
    async () => ({
      contents: [
        {
          uri: SCHEDULER_URI,
          mimeType: "text/html;profile=mcp-app",
          text: SCHEDULER_HTML,
          _meta: UI_RESOURCE_META,
        },
      ],
    }),
  );
}
