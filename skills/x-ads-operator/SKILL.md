---
name: x-ads-operator
description: Use when auditing, reporting, creating, pausing, deleting, or scheduling X Ads campaigns through AdvisorPPC tools. Contains playbooks reverse-engineered from Grok's X Ads connector.
version: 0.3.0
---

# X Ads operator playbooks

Hierarchy: **account → funding → campaign → ad group (line item) → ad (promoted tweet)**. Budget lives on the ad group. An ad serves only if campaign AND ad group are ACTIVE.

X Ads API has **no native schedule**. Use AdvisorPPC `x_ads_scheduler_setup` + `x_ads_schedule_create`. Do not invent a go-live time outside the job store. Digests never auto-resume spend.

## Audit

1. `x_ads_list_accounts`
2. `x_ads_list_funding` — trust `able_to_fund`, not `description`
3. `x_ads_list_campaigns` → `x_ads_list_line_items` → `x_ads_list_ads`
4. `x_ads_list_targeting` with `line_item_id`
5. `x_ads_get_tweets` → `x_ads_get_cards` → `x_ads_get_media`

## Analytics (≤ 7 days, whole-hour ISO times, ≤ 20 ids)

1. `x_ads_active_entities` to skip empty ids
2. `x_ads_get_analytics` (`granularity=TOTAL`, `metric_groups=ENGAGEMENT,BILLING`)
3. `x_ads_reach` for unique people
4. CPE = `billed_charge_local_micro / engagements`; divide micros by 1_000_000 for currency

## Create a website image ad (paused)

1. funding → `x_ads_create_campaign` (no budget, PAUSED)
2. `x_ads_create_ad_group` with daily/total micros + objective
3. `x_ads_search_targeting` / `x_ads_list_audiences` → `x_ads_add_targeting`
4. `x_ads_create_image_ad` or `x_ads_create_video_ad` (existing `line_item_id`, `text`, optional `destination_url`, media_url or inline)
5. `x_ads_set_status` ACTIVE only with `confirm=true` after an explicit go-live ask

Custom cards: `x_ads_upload_media` (images or chunked video) → `x_ads_create_card` → `x_ads_create_tweet` (card_uri XOR media_keys) → `x_ads_create_ad`.

## Schedule pause / resume (AdvisorPPC queue)

1. `x_ads_scheduler_setup` once (starts worker; paste snippets for Claude/ChatGPT/Cursor/Grok). Pass `account_id` so digest agents know which account.
2. Confirm entity + time with the user. Never invent ids.
3. `x_ads_schedule_create` with `kind=once` (or `cron` like `0 9 * * 1-5`), `tool=x_ads_set_status`, `arguments: {account_id, entity, entity_id, status}`, `confirm=true`.
4. Dayparting: two cron jobs — `ACTIVE` at open, `PAUSED` at close — still `confirm=true` after they named both.
5. Optional digest webhook in `x_ads_scheduler_settings` so another model vendor can triage analytics without this server changing spend.

## Audiences, DNR, pixels

- CRM list: `x_ads_create_audience` → `x_ads_audience_users` (raw emails hashed SHA-256 here) → `x_ads_add_targeting` with `CUSTOM_AUDIENCE`.
- Estimate before spend: `x_ads_estimate_audience`.
- Suppression: one DNR list per account (`x_ads_create_dnr` → `x_ads_dnr_users`). Emails only.
- X Pixel: `x_ads_list_pixels` / `x_ads_create_pixel`. `website_tag_id` is the embed/Conversion API id. Delete requires `confirm`.

## Hard rules

- Do not invent names or budgets. Multiple groups + one budget → ask split vs each.
- `entity_status=ACTIVE` requires `confirm_spend=true`.
- Pause/resume/delete require `confirm=true` and a named entity.
- Creative upload failure → STOP. Never substitute a still or a library leftover.
- Never mix in `x_organic_*` from this server.
