#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { getScheduler, schedulerEnabledByEnv } from "./schedule/index.js";
import { createServer } from "./server.js";

async function main() {
  if (schedulerEnabledByEnv()) getScheduler({ autoStart: true });
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
