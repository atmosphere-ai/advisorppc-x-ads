#!/usr/bin/env node
/** Standalone worker for stdio / AdvisorPPC backend hosts. HTTP already auto-starts. */
import { createScheduler } from "./schedule/index.js";

const sched = createScheduler({ autoStart: true });
console.error(`advisorppc-x-ads worker on ${sched.store.path}`);

process.on("SIGINT", () => {
  sched.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  sched.stop();
  process.exit(0);
});
