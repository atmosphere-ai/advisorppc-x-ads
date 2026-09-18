# MCP v2 and MCP Apps — what we targeted

Researched 2026-09-18.

## Protocol

| Item | Value |
| --- | --- |
| Spec | [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) (latest) |
| Previous Streamable HTTP | 2025-03-26, 2025-06-18, 2025-11-25 |
| SDK | `@modelcontextprotocol/server` **v2** (replaces `@modelcontextprotocol/sdk` v1) |
| HTTP entry | `createMcpHandler(factory)` — factory runs **once per request**; returns `{ fetch }` |
| Transport | Streamable HTTP: **POST** JSON-RPC to one endpoint; optional request-scoped SSE. GET-for-SSE sessions removed (SEP-2575). stdio still first-class for local hosts. |
| Version header | `MCP-Protocol-Version` on HTTP POSTs (SEP-2243 also mirrors `Mcp-Method` / `Mcp-Name`) |

## MCP Apps

| Item | Value |
| --- | --- |
| SEP | [1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) |
| Stable spec | 2026-01-26 (`ext-apps`) |
| URI | `ui://advisorppc/x-ads/dashboard` |
| MIME | `text/html;profile=mcp-app` (declared on the resource **and** each content item) |
| Linkage | tool `_meta.ui.resourceUri` + result `_meta.ui.resourceUri` |
| CSP | empty `connectDomains` / `resourceDomains` — HTML is self-contained |

Apps is an **extension** (`io.modelcontextprotocol/ui`). Hosts that do not implement it must still work via ordinary tool `content`.

## Why not wrap ads-api.x.com/mcp

X already hosts 74 1:1 Ads API tools at `https://ads-api.x.com/mcp`. This connector instead:

1. Speaks the **Grok 27-tool** vocabulary operators already use.
2. Enforces spend policy the official MCP only hints at in prose.
3. Adds composite `x_ads_create_image_ad` and an MCP App dashboard.
4. Can be hosted on AdvisorPPC infrastructure with the same guardrail model as the Google Ads plugin.
