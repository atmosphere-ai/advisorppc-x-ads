---
name: mcp-building
description: Use when building or extending this MCP server, choosing SDK v1 vs v2, Streamable HTTP vs stdio, or adding tools the Grok X Ads connector does not expose.
version: 0.1.0
---

# Building on MCP v2 (2026-07-28)

This repo uses **SDK v2** (`@modelcontextprotocol/server`), not the v1 monolith `@modelcontextprotocol/sdk`.

## Why v2

- Spec **2026-07-28** is current. Streamable HTTP is POST-only JSON-RPC (SSE only as a request-scoped response stream). The old GET-for-SSE session is gone (SEP-2575).
- `registerTool(name, { description, inputSchema: zod, annotations, _meta }, handler)`.
- Return `{ content, structuredContent, _meta }`. Annotations: `readOnlyHint`, `destructiveHint`, `openWorldHint`.
- stdio: `StdioServerTransport` from `@modelcontextprotocol/server/stdio`.
- HTTP: `createMcpHandler(factory)` from `@modelcontextprotocol/server`. The factory runs **once per request**. Optional: `@modelcontextprotocol/node` `toNodeHandler` if you mount on Express.

## Layout we use

- `src/ads/client.ts` — Ads API v12 (Bearer, form + JSON, pagination)
- `src/policy/safety.ts` — paused-by-default / confirm flags
- `src/tools/register.ts` — Grok-shaped tools + `x_ads_create_video_ad`
- `src/tools/audiences.ts` — custom audiences, estimate, DNR
- `src/tools/pixels.ts` — web event tags (X Pixel)
- `src/ads/media.ts` — simple image + v2 chunked video
- `src/apps/` — MCP Apps `ui://` resource + tool `_meta.ui.resourceUri`
- `src/index.ts` stdio · `src/http.ts` Streamable HTTP

## Adding a tool

1. Pick the Ads API v12 path from `docs/X-ADS-REVERSE-ENGINEERING.md`.
2. Zod input. Money in **local micro-units**.
3. Reads: `readOnlyHint: true` and `_meta.ui.resourceUri` so MCP App hosts render the dashboard.
4. Mutations that spend: require `confirm` / `confirm_spend`.
5. Tool name stays `x_ads_*` so Grok/Claude playbooks transfer.
6. Add a test with a mocked `fetchImpl`.

## Do not

- Put budget on `x_ads_create_campaign`.
- Proxy blindly to `https://ads-api.x.com/mcp` and drop the safety layer.
- Depend on v1 `HTTP+SSE` (`/sse` + `/messages`).
- Register tools on a shared `McpServer` outside the HTTP factory.
