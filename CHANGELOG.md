# Changelog

## 0.3.0 — 2026-09-18

- Built-in AdvisorPPC scheduler module (`@advisorppc/x-ads/schedule`)
- HTTP auto-starts the worker; `npm run worker` for stdio / backend
- Tools: `x_ads_scheduler_setup` / `_status` / `_settings`, `x_ads_schedule_list` / `_create` / `_cancel`, `x_ads_agents_list` / `_agent_set`
- Agents: publish_queue, analytics_digest, paused_audit, health (digests never auto-resume spend)
- Vendor self-setup snippets for Claude, ChatGPT, Cursor, Grok, AdvisorPPC backend
- MCP Apps scheduler view `ui://advisorppc/x-ads/scheduler`
- 51 tools total

## 0.2.0 — 2026-09-18

- Chunked video upload (Ads API v2 INIT/APPEND/FINALIZE + STATUS poll, `amplify_video`)
- Composite `x_ads_create_video_ad`
- Custom audience CRUD + hashed user load (`x_ads_audience_users`)
- Audience size estimate
- Do Not Reach list CRUD + hashed email load
- X Pixel / web event tag CRUD (`x_ads_list_pixels` …)
- 43 tools total

## 0.1.0 — 2026-09-18

First user-facing release.

- 27 Grok-shaped X Ads tools on Ads API v12
- Paused-by-default creates; `confirm_spend` / `confirm` on live-fire actions
- stdio + Streamable HTTP (`POST /mcp`)
- MCP Apps dashboard `ui://advisorppc/x-ads/dashboard`
- Skills: getting-connected, x-ads-operator, mcp-building, mcp-apps
- Claude Code plugin manifests
