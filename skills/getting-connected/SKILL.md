---
name: getting-connected
description: Use when the user asks how to connect AdvisorPPC X Ads, set X_ADS_ACCESS_TOKEN, why list_accounts is empty, OAuth scopes, or first-run setup for this MCP server.
version: 0.1.0
---

# Getting connected to AdvisorPPC X Ads

## First run

1. Build this repo (`npm install && npm run build`).
2. Put a user-context OAuth2 token in `X_ADS_ACCESS_TOKEN` (scopes `ads.read`, `ads.write`, `offline.access`; add `media.write` to upload).
3. Register the stdio server in the MCP host (see README).
4. Call `x_ads_list_accounts` with no args. A non-empty `data` array means the token can see Ads accounts.

Empty `data: []` is **not** an MCP outage. It means the X user on the token has no ads accounts (same failure mode as Grok’s first-party connector). Re-auth as the ads.x.com admin user.

## OAuth

- Authorize: `https://x.com/i/oauth2/authorize`
- Token: `https://api.x.com/2/oauth2/token`
- PKCE S256. X rejects `client_secret_post`. Always include `offline.access` or the token dies in ~2 hours.

HTTP mode: `Authorization: Bearer` on `POST /mcp` overrides env.

## Never

- Paste client secrets into chat.
- Invent an `account_id`. Always list first.
- Treat a 401 on opening `/mcp` in a browser as downtime — it is an MCP endpoint, not a web page.
