# Launch checklist — `advisorppc-x-ads`

Do **not** call this ready for users until every box in **Ready for users** is checked.

## 1. Product contract

- [x] Reverse-engineer Grok first-party X Ads (27 tools) + official Ads MCP (74 tools)
- [x] Choose MCP **2026-07-28 / SDK v2** + **MCP Apps** (SEP-1865 / ext-apps 2.x)
- [x] Create public GitHub repo `atmosphere-ai/advisorppc-x-ads`
- [x] Map Grok tool names (`x_ads_*`) onto Ads API v12

## 2. Runtime

- [x] Ads API v12 client (Bearer, form + JSON, pagination, errors)
- [x] Safety policy (paused-by-default, confirm_spend, no creative substitution, no invented budgets)
- [x] Register operator tools (43 in 0.2.0)
- [x] Composite `x_ads_create_image_ad` / `x_ads_create_video_ad` pipelines
- [x] Chunked video upload (v2 INIT/APPEND/FINALIZE + STATUS)
- [x] Custom audience CRUD + hashed users
- [x] Do Not Reach lists + hashed emails
- [x] X Pixel / web event tag CRUD
- [x] stdio transport (Claude Code / Cursor / Grok Build)
- [x] Streamable HTTP transport (`POST /mcp`)
- [x] MCP App dashboard (`ui://advisorppc/x-ads/dashboard`)
- [x] Money helpers (micro-units)

## 3. Skills & packaging

- [x] `getting-connected` skill
- [x] `x-ads-operator` skill (playbooks from reverse-engineering)
- [x] `mcp-building` skill (how this server is built on v2)
- [x] `mcp-apps` skill
- [x] Claude Code plugin + `.mcp.json`
- [x] README, SECURITY, SUPPORT, CHANGELOG, LICENSE
- [x] Reverse-engineering + MCP v2 docs

## 4. Quality

- [x] Unit tests for client, money, safety, hash, media, schema
- [x] `npm test` passes
- [x] `npm run typecheck` passes
- [x] Smoke: `tools/list` returns 43 tools
- [x] Pushed to GitHub `main`

## Ready for users

- [x] Install docs work for Claude Code, Cursor, Grok, and raw HTTP
- [x] Read tools are wired to Ads API v12 (live ads account required; empty token is a ConfigError)
- [x] Writes cannot spend unless the user explicitly confirmed (`confirm_spend` / `confirm`)
- [x] Audience/DNR identifiers are SHA-256 hashed in-process; raw PII is not logged
- [x] No secrets in the repo
- [x] Version `0.2.0` tagged in CHANGELOG

### Known 0.2.0 limits

- App event tags, tracking-partner tags, app lists, tweet previews still not wrapped.
- Org `advisorppc-org` could not host this repo (no create-repo permission); lives under `atmosphere-ai` until transferred.
