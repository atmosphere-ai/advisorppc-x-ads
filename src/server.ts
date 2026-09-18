import { McpServer } from "@modelcontextprotocol/server";
import { AdsClient, tokenFromEnv } from "./ads/client.js";
import { registerApps } from "./apps/register.js";
import { registerTools } from "./tools/register.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";

export type CreateServerOptions = {
  client?: AdsClient;
  accessToken?: string;
};

export function createServer(opts: CreateServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    {
      instructions: [
        "AdvisorPPC X Ads connector. Hierarchy: account → funding → campaign → ad group (line item) → ad (promoted tweet).",
        "Always call x_ads_list_accounts first. Budget is set on the ad group, never invent names or amounts.",
        "Creates are PAUSED. Pass confirm_spend=true only after the user explicitly asked to start spending.",
        "Pause/resume/delete require confirm=true after the user named the exact entity.",
        "If a creative upload fails, STOP — never substitute a still or a library leftover.",
        "Audience and DNR identifiers are hashed SHA-256 in this server; do not log raw emails.",
      ].join(" "),
    },
  );

  const getClient = () => {
    if (opts.client) return opts.client;
    return new AdsClient({ accessToken: opts.accessToken || tokenFromEnv() });
  };

  registerTools(server, getClient);
  registerApps(server);
  return server;
}
