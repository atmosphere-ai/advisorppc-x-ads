# Reverse-engineering notes (Grok X Ads + official Ads MCP)

Two layers exist:

| Layer | Tools | Endpoint |
| --- | --- | --- |
| Grok first-party connector | 27 `x_ads_*` | Grok Connectors → X Ads |
| Official X Ads MCP | 74 unprefixed | `https://ads-api.x.com/mcp` (Ads API `/12`) |

This package implements the **27-tool Grok vocabulary** as a first-party AdvisorPPC server, with the same safety prose Grok bakes into tool descriptions.

## Object map

Ads Manager **Ad group** = API **line_item**. **Ad** = **promoted_tweet**. Money = local micro-units (`1` currency unit = `1_000_000`).

Grok create-campaign **rejects** a campaign budget; budget is on the line item (matches current Ads Manager). `update_campaign` still accepts daily/total micros for legacy campaign-budget accounts.

## Grok → HTTP

See README tool list. Notable composites:

- `x_ads_list_creatives` = GET cards + GET media_library
- `x_ads_search_targeting` = GET `/12/targeting_criteria/{kind}`
- `x_ads_set_status` = PUT entity `entity_status`
- `x_ads_create_image_ad` = media upload + POST cards + POST tweet + POST promoted_tweets
- `x_ads_get_analytics` = GET `/12/stats/accounts/:id` with `placement=ALL_ON_TWITTER`, ≤7 days, ≤20 ids

Official MCP extras we **do not** wrap in 0.1.0: pixels, DNR lists, audience CRUD, tweet previews, `estimate_audience`, dedicated `remove_targeting` (use `replace=true` on add).

## Agent playbooks

Copied into `skills/x-ads-operator/SKILL.md`.
