---
name: mcp-apps
description: Use when adding or debugging the inline X Ads dashboard, ui:// resources, MCP Apps v2 (ext-apps 2.x / SEP-1865), or hosts that do not render Apps.
version: 0.1.0
---

# MCP Apps (v2)

MCP Apps (SEP-1865, stable **2026-01-26**, ext-apps 2.x wire-compatible with 1.x) lets a tool ship an HTML UI the host renders in a sandboxed iframe.

## Pattern in this repo

1. Resources `ui://advisorppc/x-ads/dashboard` and `ui://advisorppc/x-ads/scheduler` with MIME `text/html;profile=mcp-app`.
2. Hosts that understand `_meta.ui.resourceUri` preload the HTML.
3. Tool JSON (`structuredContent`) is the fallback — **always** return text+structured so Claude/Grok/Cursor without Apps still work.

Supported hosts (2026): Claude, Claude Desktop, VS Code Copilot, Microsoft 365 Copilot, Goose, Postman, MCPJam, ChatGPT. Grok web may ignore the UI and show JSON; that is success.

## Adding another view

- Keep HTML self-contained (inline CSS/JS). Honor host CSP; no random third-party scripts.
- Communicate with `postMessage` JSON-RPC (`ui/initialize`, tool-result notifications).
- Never put tokens in the HTML.

ext-apps 2.x Views work in 1.x hosts and vice versa. Prefer `registerResource` + tool `_meta` over a host-specific Apps SDK.
