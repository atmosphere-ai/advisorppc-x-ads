import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AdsClient } from "../ads/client.js";
import { PolicyError } from "../ads/errors.js";
import { DASHBOARD_URI } from "../apps/register.js";
import {
  CREATIVE_SUBSTITUTION_BAN,
  assertNamedMutation,
  normalizeCreateStatus,
} from "../policy/safety.js";

type ClientFactory = () => AdsClient;

/** MCP Apps linkage (SEP-1865). Hosts that ignore Apps still get JSON. */
const UI_META = { ui: { resourceUri: DASHBOARD_URI } } as const;

function text(data: unknown) {
  const payload = data ?? null;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: (typeof payload === "object" && payload !== null ? payload : { result: payload }) as Record<
      string,
      unknown
    >,
    _meta: UI_META,
  };
}

function dropEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

const accountId = z.string().describe("Ads API account id from x_ads_list_accounts, e.g. 18ce55v2od2");

export function registerTools(server: McpServer, getClient: ClientFactory): void {
  const ads = () => getClient();

  server.registerTool(
    "x_ads_list_accounts",
    {
      title: "List ad accounts",
      description:
        "List X ad accounts the connected token can manage. Returns id, name, approval status. Call this first.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async () => text(await ads().get("/12/accounts")),
  );

  server.registerTool(
    "x_ads_list_funding",
    {
      title: "List funding instruments",
      description:
        "How campaigns are paid. Trust able_to_fund=true and empty reasons_not_able_to_fund — NOT description, which for self-serve cards can read '(no payment method has been set up yet)' even when serving. The API exposes one representative instrument for self-serve accounts.",
      inputSchema: z.object({
        account_id: accountId,
        count: z.number().int().optional(),
        cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, count, cursor }) =>
      text(await ads().get(`/12/accounts/${account_id}/funding_instruments`, { count, cursor })),
  );

  server.registerTool(
    "x_ads_list_campaigns",
    {
      title: "List campaigns",
      description: "List campaigns: status (ACTIVE/PAUSED/DRAFT) and any budgets. Requires account_id.",
      inputSchema: z.object({
        account_id: accountId,
        count: z.number().int().optional(),
        cursor: z.string().optional(),
        with_deleted: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, count, cursor, with_deleted }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/campaigns`, {
          count,
          cursor,
          with_deleted,
        }),
      ),
  );

  server.registerTool(
    "x_ads_list_line_items",
    {
      title: "List ad groups",
      description:
        "List line items (ad groups): status, objective, bid. Optionally filter by campaign_id. Budget lives HERE, not on the campaign.",
      inputSchema: z.object({
        account_id: accountId,
        campaign_id: z.string().optional(),
        count: z.number().int().optional(),
        cursor: z.string().optional(),
        with_deleted: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, campaign_id, count, cursor, with_deleted }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/line_items`, {
          campaign_id,
          count,
          cursor,
          with_deleted,
        }),
      ),
  );

  server.registerTool(
    "x_ads_list_ads",
    {
      title: "List ads",
      description:
        "List promoted posts. Each row has status and tweet_id. Filter with line_item_id. Deleted ads are hidden unless with_deleted=true; the underlying post is not deleted.",
      inputSchema: z.object({
        account_id: accountId,
        line_item_id: z.string().optional(),
        count: z.number().int().optional(),
        cursor: z.string().optional(),
        with_deleted: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, line_item_id, count, cursor, with_deleted }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/promoted_tweets`, {
          line_item_id,
          count,
          cursor,
          with_deleted,
        }),
      ),
  );

  server.registerTool(
    "x_ads_list_targeting",
    {
      title: "List targeting",
      description: "List targeting criteria for an ad group. Always pass line_item_id to see why groups differ.",
      inputSchema: z.object({
        account_id: accountId,
        line_item_id: z.string().optional(),
        count: z.number().int().optional(),
        cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, line_item_id, count, cursor }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/targeting_criteria`, {
          line_item_id,
          count,
          cursor,
        }),
      ),
  );

  server.registerTool(
    "x_ads_list_audiences",
    {
      title: "List custom audiences",
      description: "List tailored audiences with size and targetable status. Use ids as CUSTOM_AUDIENCE targeting values.",
      inputSchema: z.object({
        account_id: accountId,
        count: z.number().int().optional(),
        cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, count, cursor }) =>
      text(await ads().get(`/12/accounts/${account_id}/custom_audiences`, { count, cursor })),
  );

  server.registerTool(
    "x_ads_list_creatives",
    {
      title: "List creatives",
      description:
        "Creative inventory: cards (cap 200) and media library (cap 50) in one call. Page with cards_cursor / media_cursor.",
      inputSchema: z.object({
        account_id: accountId,
        count: z.number().int().optional(),
        cards_cursor: z.string().optional(),
        media_cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, count, cards_cursor, media_cursor }) => {
      const client = ads();
      const cap = count ?? 50;
      const [cards, media] = await Promise.all([
        client.get(`/12/accounts/${account_id}/cards`, { count: Math.min(cap, 200), cursor: cards_cursor }),
        client.get(`/12/accounts/${account_id}/media_library`, {
          count: Math.min(cap, 50),
          cursor: media_cursor,
        }),
      ]);
      return text({ cards, media_library: media });
    },
  );

  server.registerTool(
    "x_ads_get_tweets",
    {
      title: "Get ad posts",
      description:
        "Fetch posts behind ads (tweet_id from x_ads_list_ads) WITH card_uri and media. Use this, not a generic post fetch, to tell whether an ad has a card/image. Up to ~200 ids. tweet_type default PUBLISHED (includes promoted-only).",
      inputSchema: z.object({
        account_id: accountId,
        tweet_ids: z.array(z.string()).min(1),
        tweet_type: z.enum(["PUBLISHED", "SCHEDULED", "DRAFT"]).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, tweet_ids, tweet_type }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/tweets`, {
          tweet_ids: tweet_ids.join(","),
          tweet_type: tweet_type ?? "PUBLISHED",
        }),
      ),
  );

  server.registerTool(
    "x_ads_get_cards",
    {
      title: "Get cards",
      description:
        "Expand card_uri values (card://…) into type, components, buttons, media_keys. Images inside a card are media_keys, not URLs — pass those to x_ads_get_media.",
      inputSchema: z.object({
        account_id: accountId,
        card_uris: z.array(z.string()).min(1),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, card_uris }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/cards`, {
          card_uris: card_uris.join(","),
        }),
      ),
  );

  server.registerTool(
    "x_ads_get_media",
    {
      title: "Get media URLs",
      description: "Resolve media_key values (e.g. 3_2069…) to media_url / poster_media_url from the Media Library.",
      inputSchema: z.object({
        account_id: accountId,
        media_keys: z.array(z.string()).min(1),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, media_keys }) => {
      const client = ads();
      const items = [];
      for (const key of media_keys) {
        items.push(await client.get(`/12/accounts/${account_id}/media_library/${encodeURIComponent(key)}`));
      }
      return text({ data: items });
    },
  );

  const targetingKind = z.enum([
    "locations",
    "interests",
    "languages",
    "platforms",
    "devices",
    "events",
    "app_store_categories",
    "conversations",
    "network_operators",
    "tv_markets",
    "tv_shows",
  ]);

  server.registerTool(
    "x_ads_search_targeting",
    {
      title: "Search targeting values",
      description:
        "Resolve human terms into targeting_value ids for x_ads_add_targeting. kind ∈ locations, interests, languages, platforms, devices, events, app_store_categories, conversations, network_operators, tv_markets, tv_shows. For locations pass query and optional location_type. Custom audiences: use x_ads_list_audiences.",
      inputSchema: z.object({
        kind: targetingKind,
        query: z.string().optional(),
        location_type: z.enum(["COUNTRIES", "REGIONS", "CITIES", "METROS", "POSTAL_CODES"]).optional(),
        count: z.number().int().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ kind, query, location_type, count }) =>
      text(
        await ads().get(`/12/targeting_criteria/${kind}`, {
          q: query,
          location_type,
          count,
        }),
      ),
  );

  server.registerTool(
    "x_ads_active_entities",
    {
      title: "Active entities",
      description:
        "Which CAMPAIGN / LINE_ITEM / PROMOTED_TWEET ids had activity in a window. Call before analytics so you don't request empty ids. Times are whole-hour ISO 8601.",
      inputSchema: z.object({
        account_id: accountId,
        entity: z.enum(["CAMPAIGN", "LINE_ITEM", "PROMOTED_TWEET"]),
        start_time: z.string(),
        end_time: z.string(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, entity, start_time, end_time }) =>
      text(
        await ads().get(`/12/stats/accounts/${account_id}/active_entities`, {
          entity,
          start_time,
          end_time,
        }),
      ),
  );

  server.registerTool(
    "x_ads_get_analytics",
    {
      title: "Get analytics",
      description:
        "Sync stats for up to 20 campaigns, ad groups, or ads. Range must be ≤ 7 days. Times whole-hour ISO 8601. granularity TOTAL (default) / DAY / HOUR. metric_groups default ENGAGEMENT,BILLING. Placement ALL_ON_TWITTER. Spend is billed_charge_local_micro / 1_000_000.",
      inputSchema: z.object({
        account_id: accountId,
        entity: z.enum(["CAMPAIGN", "LINE_ITEM", "PROMOTED_TWEET"]),
        entity_ids: z.array(z.string()).min(1).max(20),
        start_time: z.string(),
        end_time: z.string(),
        granularity: z.enum(["TOTAL", "DAY", "HOUR"]).optional(),
        metric_groups: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async (args) =>
      text(
        await ads().get(`/12/stats/accounts/${args.account_id}`, {
          entity: args.entity,
          entity_ids: args.entity_ids.join(","),
          start_time: args.start_time,
          end_time: args.end_time,
          granularity: args.granularity ?? "TOTAL",
          metric_groups: args.metric_groups ?? "ENGAGEMENT,BILLING",
          placement: "ALL_ON_TWITTER",
        }),
      ),
  );

  server.registerTool(
    "x_ads_reach",
    {
      title: "Campaign reach",
      description: "Unique reach + average frequency for campaigns. Window ≤ 7 days, whole-hour ISO 8601. Impressions cannot tell you this.",
      inputSchema: z.object({
        account_id: accountId,
        campaign_ids: z.array(z.string()).min(1).max(20),
        start_time: z.string(),
        end_time: z.string(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, campaign_ids, start_time, end_time }) =>
      text(
        await ads().get(`/12/stats/accounts/${account_id}/reach/campaigns`, {
          campaign_ids: campaign_ids.join(","),
          start_time,
          end_time,
        }),
      ),
  );

  server.registerTool(
    "x_ads_create_campaign",
    {
      title: "Create campaign",
      description:
        "Create a campaign PAUSED by default (no spend). Pass entity_status=ACTIVE only with confirm_spend=true after an explicit user ask. Needs funding_instrument_id. BUDGETS ARE SET PER AD GROUP — do not pass a campaign budget. Don't invent names.",
      inputSchema: z.object({
        account_id: accountId,
        funding_instrument_id: z.string(),
        name: z.string(),
        entity_status: z.enum(["PAUSED", "ACTIVE", "DRAFT"]).optional(),
        confirm_spend: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ account_id, funding_instrument_id, name, entity_status, confirm_spend }) => {
      const status = normalizeCreateStatus({ entity_status, confirm_spend });
      return text(
        await ads().postForm(`/12/accounts/${account_id}/campaigns`, {
          funding_instrument_id,
          name,
          entity_status: status,
        }),
      );
    },
  );

  server.registerTool(
    "x_ads_create_ad_group",
    {
      title: "Create ad group",
      description:
        "Create a line item under a campaign. PAUSED by default. All groups in a campaign must share objective and product_type. Budget is set HERE (daily_budget_amount_local_micro / total_budget_amount_local_micro). Bid omitted = automatic. Amounts are local micro-units (1 unit = 1_000_000). If creating multiple groups from one stated budget, ASK split vs each. confirm_spend required for ACTIVE.",
      inputSchema: z.object({
        account_id: accountId,
        campaign_id: z.string(),
        objective: z.string().describe("ENGAGEMENTS, WEBSITE_CLICKS, REACH, VIDEO_VIEWS, FOLLOWERS, APP_INSTALLS, …"),
        name: z.string().optional(),
        product_type: z.string().optional(),
        placements: z.string().optional(),
        entity_status: z.enum(["PAUSED", "ACTIVE", "DRAFT"]).optional(),
        start_time: z.string().optional(),
        bid_amount_local_micro: z.number().int().optional(),
        daily_budget_amount_local_micro: z.number().int().optional(),
        total_budget_amount_local_micro: z.number().int().optional(),
        confirm_spend: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async (args) => {
      const status = normalizeCreateStatus(args);
      return text(
        await ads().postForm(`/12/accounts/${args.account_id}/line_items`, {
          campaign_id: args.campaign_id,
          objective: args.objective,
          name: args.name,
          product_type: args.product_type ?? "PROMOTED_TWEETS",
          placements: args.placements ?? "ALL_ON_TWITTER",
          entity_status: status,
          start_time: args.start_time,
          bid_amount_local_micro: args.bid_amount_local_micro,
          daily_budget_amount_local_micro: args.daily_budget_amount_local_micro,
          total_budget_amount_local_micro: args.total_budget_amount_local_micro,
        }),
      );
    },
  );

  server.registerTool(
    "x_ads_update_campaign",
    {
      title: "Update campaign",
      description:
        "Partial update of name and/or budget micros. Only change fields the user named. Daily must be ≤ total. Money-affecting: pass confirm=true.",
      inputSchema: z.object({
        account_id: accountId,
        campaign_id: z.string(),
        name: z.string().optional(),
        daily_budget_amount_local_micro: z.number().int().optional(),
        total_budget_amount_local_micro: z.number().int().optional(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async (args) => {
      if (
        args.daily_budget_amount_local_micro !== undefined ||
        args.total_budget_amount_local_micro !== undefined
      ) {
        assertNamedMutation(args.confirm, "Updating a live campaign budget spends money.");
      }
      return text(
        await ads().putForm(`/12/accounts/${args.account_id}/campaigns/${args.campaign_id}`, {
          name: args.name,
          daily_budget_amount_local_micro: args.daily_budget_amount_local_micro,
          total_budget_amount_local_micro: args.total_budget_amount_local_micro,
        }),
      );
    },
  );

  server.registerTool(
    "x_ads_update_ad_group",
    {
      title: "Update ad group",
      description: "Partial update of name, bid, and/or budget micros. Only change what the user named. confirm=true for money fields.",
      inputSchema: z.object({
        account_id: accountId,
        line_item_id: z.string(),
        name: z.string().optional(),
        bid_amount_local_micro: z.number().int().optional(),
        daily_budget_amount_local_micro: z.number().int().optional(),
        total_budget_amount_local_micro: z.number().int().optional(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async (args) => {
      if (
        args.bid_amount_local_micro !== undefined ||
        args.daily_budget_amount_local_micro !== undefined ||
        args.total_budget_amount_local_micro !== undefined
      ) {
        assertNamedMutation(args.confirm, "Updating a live ad group bid/budget spends money.");
      }
      return text(
        await ads().putForm(`/12/accounts/${args.account_id}/line_items/${args.line_item_id}`, {
          name: args.name,
          bid_amount_local_micro: args.bid_amount_local_micro,
          daily_budget_amount_local_micro: args.daily_budget_amount_local_micro,
          total_budget_amount_local_micro: args.total_budget_amount_local_micro,
        }),
      );
    },
  );

  server.registerTool(
    "x_ads_set_status",
    {
      title: "Pause or resume",
      description:
        "Set a campaign or ad group to ACTIVE or PAUSED. Pausing a campaign stops its groups and ads. Ads have no on/off switch — pause the group or delete the ad. confirm=true after an explicit named ask. Never inferred.",
      inputSchema: z.object({
        account_id: accountId,
        entity: z.enum(["CAMPAIGN", "LINE_ITEM"]),
        entity_id: z.string(),
        status: z.enum(["ACTIVE", "PAUSED"]),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, entity, entity_id, status, confirm }) => {
      assertNamedMutation(confirm, `Setting ${entity} ${entity_id} to ${status} changes live spend.`);
      const path =
        entity === "CAMPAIGN"
          ? `/12/accounts/${account_id}/campaigns/${entity_id}`
          : `/12/accounts/${account_id}/line_items/${entity_id}`;
      return text(await ads().putForm(path, { entity_status: status }));
    },
  );

  server.registerTool(
    "x_ads_delete",
    {
      title: "Delete entity",
      description:
        "SOFT-delete CAMPAIGN, LINE_ITEM, or PROMOTED_TWEET. Children go with the parent. Cannot be undone here. Deleting an ad does not delete the post. confirm=true after the user named the exact entity. Never inferred.",
      inputSchema: z.object({
        account_id: accountId,
        entity: z.enum(["CAMPAIGN", "LINE_ITEM", "PROMOTED_TWEET"]),
        entity_id: z.string(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ account_id, entity, entity_id, confirm }) => {
      assertNamedMutation(confirm, `Deleting ${entity} ${entity_id} is destructive.`);
      const path =
        entity === "CAMPAIGN"
          ? `/12/accounts/${account_id}/campaigns/${entity_id}`
          : entity === "LINE_ITEM"
            ? `/12/accounts/${account_id}/line_items/${entity_id}`
            : `/12/accounts/${account_id}/promoted_tweets/${entity_id}`;
      return text(await ads().delete(path));
    },
  );

  server.registerTool(
    "x_ads_add_targeting",
    {
      title: "Add targeting",
      description:
        "Add targeting on an ad group. criteria: {targeting_type, targeting_value, operator_type?}. Types: LOCATION, CUSTOM_AUDIENCE, FOLLOWER_LOOK_ALIKE, INTEREST, LANGUAGE, PLATFORM, DEVICE, GENDER, AGE, EVENT, KEYWORD. GENDER=MALE/FEMALE, AGE like AGE_25_TO_34. operator EQ include (default) or NE exclude. replace=true removes existing criteria of the SAME types first. Only set targeting the user asked for.",
      inputSchema: z.object({
        account_id: accountId,
        line_item_id: z.string(),
        replace: z.boolean().optional(),
        criteria: z
          .array(
            z.object({
              targeting_type: z.string(),
              targeting_value: z.string(),
              operator_type: z.enum(["EQ", "NE"]).optional(),
            }),
          )
          .min(1),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, line_item_id, replace, criteria }) => {
      const client = ads();
      if (replace) {
        const existing = await client.get<{ data: Array<{ id: string; targeting_type: string; line_item_id: string }> }>(
          `/12/accounts/${account_id}/targeting_criteria`,
          { line_item_id, count: 1000 },
        );
        const types = new Set(criteria.map((c) => c.targeting_type.toUpperCase()));
        for (const row of existing.data ?? []) {
          if (types.has(String(row.targeting_type).toUpperCase()) && row.id) {
            await client.delete(`/12/accounts/${account_id}/targeting_criteria/${row.id}`);
          }
        }
      }
      const created = [];
      for (const c of criteria) {
        created.push(
          await client.postForm(`/12/accounts/${account_id}/targeting_criteria`, {
            line_item_id,
            targeting_type: c.targeting_type,
            targeting_value: c.targeting_value,
            operator_type: c.operator_type ?? "EQ",
          }),
        );
      }
      return text({ data: created });
    },
  );

  server.registerTool(
    "x_ads_upload_media",
    {
      title: "Upload media",
      description:
        "Upload an image via media_url or inline base64 (media.data). Returns media_key for x_ads_create_card or x_ads_create_tweet. Provide exactly one source. Video/chunked upload is not in 0.1.0 — use a still or pre-uploaded media_key. " +
        CREATIVE_SUBSTITUTION_BAN,
      inputSchema: z.object({
        account_id: accountId,
        media_url: z.string().url().optional(),
        media: z
          .object({
            data: z.string(),
            encoding: z.enum(["base64"]).default("base64"),
            file_name: z.string().optional(),
            mime_type: z.string().optional(),
          })
          .optional(),
        name: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, media_url, media, name }) => {
      if (!!media_url === !!media) {
        throw new PolicyError("Provide exactly one of media_url or media.");
      }
      const client = ads();
      let mediaKey: string;
      if (media_url) {
        const bin = await fetch(media_url);
        if (!bin.ok) throw new PolicyError(`Failed to fetch media_url: ${bin.status}`);
        const buf = Buffer.from(await bin.arrayBuffer());
        mediaKey = await uploadSimpleMedia(client.accessToken, buf, media?.mime_type);
      } else {
        const buf = Buffer.from(media!.data, "base64");
        mediaKey = await uploadSimpleMedia(client.accessToken, buf, media!.mime_type);
      }
      const library = await client.postForm(`/12/accounts/${account_id}/media_library`, {
        media_key: mediaKey,
        name,
      });
      return text({ media_key: mediaKey, media_library: library });
    },
  );

  server.registerTool(
    "x_ads_create_card",
    {
      title: "Create card",
      description:
        'Create an ad card from raw components. Returns card_uri. Website: [{"type":"MEDIA","media_key":"…"},{"type":"DETAILS","title":"…","destination":{"type":"WEBSITE","url":"https://…"}}]. App cards use BUTTON not DETAILS. Carousel uses SWIPEABLE_MEDIA. ' +
        CREATIVE_SUBSTITUTION_BAN,
      inputSchema: z.object({
        account_id: accountId,
        name: z.string().optional(),
        components: z.array(z.record(z.string(), z.unknown())).min(1),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, name, components }) =>
      text(
        await ads().postJson(`/12/accounts/${account_id}/cards`, dropEmpty({ name, components })),
      ),
  );

  server.registerTool(
    "x_ads_create_tweet",
    {
      title: "Create ad post",
      description:
        "Create a promoted-only (nullcast) post. media_keys XOR card_uri. Returns tweet id; promote with x_ads_create_ad. nullcast default true. " +
        CREATIVE_SUBSTITUTION_BAN,
      inputSchema: z.object({
        account_id: accountId,
        text: z.string(),
        media_keys: z.array(z.string()).optional(),
        card_uri: z.string().optional(),
        nullcast: z.boolean().optional(),
        as_user_id: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, text: body, media_keys, card_uri, nullcast, as_user_id }) => {
      if (media_keys?.length && card_uri) {
        throw new PolicyError("Give media_keys OR card_uri, not both.");
      }
      return text(
        await ads().postForm(`/12/accounts/${account_id}/tweet`, {
          text: body,
          media_keys: media_keys?.join(","),
          card_uri,
          nullcast: nullcast ?? true,
          as_user_id,
        }),
      );
    },
  );

  server.registerTool(
    "x_ads_create_ad",
    {
      title: "Promote post",
      description:
        "Promote an EXISTING post under an ad group. Ad serves only if group AND campaign are ACTIVE. For a brand-new image use x_ads_create_image_ad. " +
        CREATIVE_SUBSTITUTION_BAN,
      inputSchema: z.object({
        account_id: accountId,
        line_item_id: z.string(),
        tweet_id: z.string(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, line_item_id, tweet_id }) =>
      text(
        await ads().postForm(`/12/accounts/${account_id}/promoted_tweets`, {
          line_item_id,
          tweet_ids: tweet_id,
        }),
      ),
  );

  server.registerTool(
    "x_ads_create_image_ad",
    {
      title: "Create image ad (pipeline)",
      description:
        "Composite: upload creative → website card → nullcast post → promote onto an EXISTING ad group. Provide media_url or inline image. Requires text + destination_url. Serves only when campaign and ad group are ACTIVE. " +
        CREATIVE_SUBSTITUTION_BAN,
      inputSchema: z.object({
        account_id: accountId,
        line_item_id: z.string(),
        text: z.string(),
        destination_url: z.string().url(),
        name: z.string().optional(),
        media_url: z.string().url().optional(),
        image: z
          .object({
            data: z.string(),
            encoding: z.enum(["base64"]).default("base64"),
            mime_type: z.string().optional(),
            file_name: z.string().optional(),
          })
          .optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async (args) => {
      if (!!args.media_url === !!args.image) {
        throw new PolicyError("Provide exactly one of media_url or image.");
      }
      const client = ads();
      let buf: Buffer;
      if (args.media_url) {
        const bin = await fetch(args.media_url);
        if (!bin.ok) throw new PolicyError(`Creative fetch failed: ${bin.status}. ${CREATIVE_SUBSTITUTION_BAN}`);
        buf = Buffer.from(await bin.arrayBuffer());
      } else {
        buf = Buffer.from(args.image!.data, "base64");
      }
      const media_key = await uploadSimpleMedia(client.accessToken, buf, args.image?.mime_type);
      await client.postForm(`/12/accounts/${args.account_id}/media_library`, {
        media_key,
        name: args.name,
      });
      const card = (await client.postJson(`/12/accounts/${args.account_id}/cards`, {
        name: args.name,
        components: [
          { type: "MEDIA", media_key },
          {
            type: "DETAILS",
            title: args.name ?? args.text.slice(0, 70),
            destination: { type: "WEBSITE", url: args.destination_url },
          },
        ],
      })) as { data?: { card_uri?: string; uri?: string } };
      const card_uri = card.data?.card_uri || card.data?.uri;
      if (!card_uri) throw new PolicyError(`Card create did not return card_uri. ${CREATIVE_SUBSTITUTION_BAN}`);
      const tweet = (await client.postForm(`/12/accounts/${args.account_id}/tweet`, {
        text: args.text,
        card_uri,
        nullcast: true,
      })) as { data?: { id_str?: string; id?: string } };
      const tweet_id = String(tweet.data?.id_str ?? tweet.data?.id ?? "");
      if (!tweet_id) throw new PolicyError(`Post create failed. ${CREATIVE_SUBSTITUTION_BAN}`);
      const ad = await client.postForm(`/12/accounts/${args.account_id}/promoted_tweets`, {
        line_item_id: args.line_item_id,
        tweet_ids: tweet_id,
      });
      return text({ media_key, card_uri, tweet_id, ad });
    },
  );
}

async function uploadSimpleMedia(accessToken: string, buf: Buffer, mime?: string): Promise<string> {
  const form = new FormData();
  const type = mime ?? "image/png";
  const blob = new Blob([new Uint8Array(buf)], { type });
  form.append("media", blob, type.includes("gif") ? "upload.gif" : type.includes("jpeg") ? "upload.jpg" : "upload.png");
  form.append("media_category", "tweet_image");
  const res = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const json = (await res.json()) as { media_id_string?: string; media_key?: string; errors?: unknown };
  if (!res.ok) {
    throw new PolicyError(
      `Media upload failed (${res.status}): ${JSON.stringify(json.errors ?? json)}. ${CREATIVE_SUBSTITUTION_BAN}`,
    );
  }
  const key = json.media_key || (json.media_id_string ? `3_${json.media_id_string}` : "");
  if (!key) throw new PolicyError(`Media upload returned no media_key. ${CREATIVE_SUBSTITUTION_BAN}`);
  return key;
}

export const TOOL_COUNT = 27;
