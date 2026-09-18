# AdvisorPPC scheduler module

X Ads API **cannot** natively schedule pause/resume or budget changes. This package ships a real queue the **AdvisorPPC backend can import**, and that **Claude, ChatGPT, Cursor, and Grok** drive through MCP tools. HTTP mode **starts the worker by itself**.

## Import (backend)

```ts
import { createScheduler } from "@advisorppc/x-ads/schedule";

const sched = createScheduler({ accessToken: process.env.X_ADS_ACCESS_TOKEN });
sched.start(); // persists to ADVISORPPC_JOBS_PATH (~/.advisorppc/jobs/x-ads.json)
```

Same shape on organic: `@advisorppc/x-organic/schedule`.

## Auto-setup

Call `x_ads_scheduler_setup`. It:

1. Creates the job store
2. Starts the in-process worker
3. Enables `health` + `publish_queue`
4. Returns paste-ready snippets for Claude, ChatGPT, Cursor, Grok, raw HTTP, and the AdvisorPPC backend

Optional `webhook_url`: digest agents POST JSON snapshots so **any** model vendor can triage analytics/paused entities without this server changing spend.

Optional `account_id`: stored on digest agents (or set `X_ADS_ACCOUNT_ID`).

## Agents (ads)

| Agent | Does | Never does |
| --- | --- | --- |
| `publish_queue` | Fires due `schedule_create` jobs | Invent entities or spend |
| `analytics_digest` | Last-24h campaign stats snapshot | Change status |
| `paused_audit` | Lists PAUSED campaigns/groups | Auto-resume |
| `health` | `GET /12/accounts` | Write |

Organic agents: `publish_queue`, `mention_digest`, `inbox_digest`, `health`.

## Allowlisted jobs

`x_ads_set_status` · `x_ads_update_campaign` · `x_ads_update_ad_group` · `x_ads_delete`

Creates, media, audiences, and pixels stay out of the queue — build them PAUSED, then schedule `set_status` ACTIVE.

## Worker

| Mode | Worker |
| --- | --- |
| `npm run start:http` | Auto-start unless `ADVISORPPC_SCHEDULER=0` |
| stdio | Off. `ADVISORPPC_SCHEDULER=1` or `npm run worker` |
| Backend import | `sched.start()` |

Scheduled fires use **`X_ADS_ACCESS_TOKEN` from the environment**, not a per-request Bearer. GET `/scheduler` on HTTP.

## Safety

- `schedule_create` requires `confirm=true` and user-supplied ids/status
- Allowlisted tools only
- `publish_queue` disabled → due jobs are held
- Digests never auto-resume
- No native X schedule is claimed
