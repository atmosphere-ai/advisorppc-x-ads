# AdvisorPPC X Ads

**Policy-safe X (Twitter) Ads for MCP clients** — Claude Code, Cursor, Grok, VS Code, or any Streamable HTTP host.

This is the operator connector reverse-engineered from Grok’s first-party **X Ads** tools (27 curated tools) and mapped onto **Ads API v12**, plus audience/pixel/DNR and chunked video that Grok’s 27 omit. Writes default to **PAUSED**. Spend, pause, and delete require an explicit confirm flag after a named user ask.

[Website](https://advisorppc.com) · [Tasks](TASKS.md) · [Reverse-engineering](docs/X-ADS-REVERSE-ENGINEERING.md) · [MCP v2 notes](docs/MCP-V2.md) · [Scheduler](docs/SCHEDULER.md)

## What you get

| Layer | Detail |
| --- | --- |
| Protocol | MCP **2026-07-28** (SDK v2 `@modelcontextprotocol/server`) |
| Transports | **stdio** (local) and **Streamable HTTP** `POST /mcp` |
| UI | **MCP Apps** dashboard + scheduler (`ui://advisorppc/x-ads/dashboard`, `…/scheduler`) |
| API | `https://ads-api.x.com/12` with OAuth2 Bearer (`ads.read` / `ads.write`) |
| Safety | Paused-by-default, `confirm_spend` / `confirm`, no creative substitution, budget on the **ad group** |
| Scheduler | AdvisorPPC queue (X has none). HTTP auto-starts the worker. Import `@advisorppc/x-ads/schedule` in the backend. |

## Tools (51)

**Read:** `x_ads_list_accounts` · `x_ads_list_funding` · `x_ads_list_campaigns` · `x_ads_list_line_items` · `x_ads_list_ads` · `x_ads_list_targeting` · `x_ads_list_audiences` · `x_ads_audience_targeted` · `x_ads_list_dnr` · `x_ads_list_pixels` · `x_ads_get_pixel` · `x_ads_list_creatives` · `x_ads_get_tweets` · `x_ads_get_cards` · `x_ads_get_media` · `x_ads_search_targeting` · `x_ads_estimate_audience` · `x_ads_active_entities` · `x_ads_get_analytics` · `x_ads_reach`

**Write structure:** `x_ads_create_campaign` · `x_ads_create_ad_group` · `x_ads_update_campaign` · `x_ads_update_ad_group` · `x_ads_set_status` · `x_ads_add_targeting` · `x_ads_delete`

**Audiences & DNR:** `x_ads_create_audience` · `x_ads_update_audience` · `x_ads_delete_audience` · `x_ads_audience_users` · `x_ads_create_dnr` · `x_ads_delete_dnr` · `x_ads_dnr_users`

**Pixels (web event tags):** `x_ads_create_pixel` · `x_ads_update_pixel` · `x_ads_delete_pixel`

**Write creative:** `x_ads_upload_media` (images + chunked video) · `x_ads_create_card` · `x_ads_create_tweet` · `x_ads_create_ad` · `x_ads_create_image_ad` · `x_ads_create_video_ad`

**Scheduler / agents:** `x_ads_scheduler_setup` · `x_ads_scheduler_status` · `x_ads_scheduler_settings` · `x_ads_schedule_list` · `x_ads_schedule_create` · `x_ads_schedule_cancel` · `x_ads_agents_list` · `x_ads_agent_set`

## Install

```bash
git clone https://github.com/atmosphere-ai/advisorppc-x-ads
cd advisorppc-x-ads
npm install
cp .env.example .env   # set X_ADS_ACCESS_TOKEN
npm run build
```

Token: an X developer app with scopes `ads.read`, `ads.write`, `offline.access` (and `media.write` if you upload). Auth URL `https://x.com/i/oauth2/authorize`, token URL `https://api.x.com/2/oauth2/token`. PKCE S256; X rejects `client_secret_post`.

### Claude Code / Cursor (stdio)

```json
{
  "mcpServers": {
    "advisorppc-x-ads": {
      "command": "node",
      "args": ["/absolute/path/to/advisorppc-x-ads/dist/index.js"],
      "env": { "X_ADS_ACCESS_TOKEN": "…", "ADVISORPPC_SCHEDULER": "1" }
    }
  }
}
```

Or the plugin path: `claude plugin marketplace add atmosphere-ai/advisorppc-x-ads` then install `advisorppc-x-ads@advisorppc`.

### Streamable HTTP

```bash
npm run start:http
# POST http://127.0.0.1:3333/mcp
# GET  http://127.0.0.1:3333/scheduler
# Authorization: Bearer <token>  (overrides env)
```

Grok web custom connector: server URL of your hosted `/mcp`, PKCE, scopes `ads.read ads.write offline.access`.

### Grok Build CLI

```toml
[mcp_servers.advisorppc-x-ads]
command = "node"
args = ["/absolute/path/to/dist/index.js"]

[mcp_servers.advisorppc-x-ads.env]
X_ADS_ACCESS_TOKEN = "…"
ADVISORPPC_SCHEDULER = "1"
```

## Hierarchy (do not skip)

```
account → funding instrument → campaign → ad group (line item)
                                      ├─ targeting
                                      └─ ad (promoted tweet → tweet → card → media_key)
```

Budget is on the **ad group**. Campaign create does not take a budget. An ad serves only when **campaign and ad group are both ACTIVE**.

## Safety

| Action | Default | To override |
| --- | --- | --- |
| Create campaign / ad group | `PAUSED` | `entity_status=ACTIVE` **and** `confirm_spend=true` after an explicit “start/go live” |
| Pause / resume / delete | refused | `confirm=true` after the user named the entity |
| Failed creative | **stop** | never promote a substitute |
| Invented name or budget | forbidden | user supplies it |
| Schedule | AdvisorPPC queue | `x_ads_scheduler_setup` then `schedule_create` (`confirm=true`). HTTP worker auto-starts. |

## Skills (bundled)

| Skill | When to use |
| --- | --- |
| `getting-connected` | Auth, tokens, first `list_accounts` |
| `x-ads-operator` | Playbooks (audit, analytics, create image ad, schedule pause/resume) |
| `mcp-building` | How this server is built on MCP v2 |
| `mcp-apps` | Inline dashboard / `ui://` resources |

## Scheduler (built-in)

X cannot natively schedule. Call **`x_ads_scheduler_setup`** once — it starts the worker and returns paste-ready configs for Claude, ChatGPT, Cursor, Grok, and the AdvisorPPC backend (`import { createScheduler } from "@advisorppc/x-ads/schedule"`).

Agents: `publish_queue` (fires due jobs), `analytics_digest` / `paused_audit` (snapshots + optional webhook, **never** auto-resume spend), `health`. Allowlisted jobs: `set_status`, `update_campaign`, `update_ad_group`, `delete`. Details: [docs/SCHEDULER.md](docs/SCHEDULER.md).

## Develop

```bash
npm test
npm run typecheck
npm run dev          # stdio
npm run dev:http
npm run worker
```

## What this is not

- Not a 1:1 clone of X’s official 74-tool MCP at `https://ads-api.x.com/mcp` (app lists, tweet previews, app event tags, and tracking-partner tags still live there).
- Not a **native** X scheduler. The built-in queue is AdvisorPPC's.
- Not organic posting — that is [`atmosphere-ai/advisorppc-x-organic`](https://github.com/atmosphere-ai/advisorppc-x-organic).
- Not a Google Ads connector — that is [`advisorppc-org/advisorppc-plugin`](https://github.com/advisorppc-org/advisorppc-plugin) → `https://mcp.advisorppc.com/claude`.

## License

MIT for this repository. The AdvisorPPC name and hosted service remain Advisor Media.
