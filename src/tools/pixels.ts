import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assertNamedMutation } from "../policy/safety.js";
import { accountId, text, type ClientFactory, UI_META } from "./common.js";

const pixelType = z.enum([
  "SITE_VISIT",
  "PURCHASE",
  "SIGN_UP",
  "DOWNLOAD",
  "CUSTOM",
  "CONTENT_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_INITIATED",
  "PAYMENT_INFO",
  "ADD_TO_WISHLIST",
  "SEARCH",
  "LEAD",
]);

const windowDays = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(7),
  z.literal(14),
  z.literal(30),
  z.literal(60),
  z.literal(90),
]);

export function registerPixelTools(server: McpServer, getClient: ClientFactory): void {
  const ads = () => getClient();

  server.registerTool(
    "x_ads_list_pixels",
    {
      title: "List X Pixels (web event tags)",
      description:
        "List Universal Website Tags / conversion pixels. id is the web_event_tag_id; website_tag_id is the pixel id used in embed code and Conversion API (tw-{website_tag_id}-…). embed_code is the snippet to put on the site.",
      inputSchema: z.object({
        account_id: accountId,
        count: z.number().int().optional(),
        cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, count, cursor }) =>
      text(await ads().get(`/12/accounts/${account_id}/web_event_tags`, { count, cursor })),
  );

  server.registerTool(
    "x_ads_get_pixel",
    {
      title: "Get X Pixel",
      description: "Fetch one web event tag: type, windows, retargeting, embed_code, website_tag_id.",
      inputSchema: z.object({
        account_id: accountId,
        web_event_tag_id: z.string(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, web_event_tag_id }) =>
      text(await ads().get(`/12/accounts/${account_id}/web_event_tags/${web_event_tag_id}`)),
  );

  server.registerTool(
    "x_ads_create_pixel",
    {
      title: "Create X Pixel (web event tag)",
      description:
        "Create a conversion / site-visit web event tag. type default SITE_VISIT. click_window and view_through_window in days (0,1,7,14,30,60,90). retargeting_enabled default false. Returns embed_code + website_tag_id. Don't invent names.",
      inputSchema: z.object({
        account_id: accountId,
        name: z.string(),
        type: pixelType.optional(),
        click_window: windowDays.optional(),
        view_through_window: windowDays.optional(),
        retargeting_enabled: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, name, type, click_window, view_through_window, retargeting_enabled }) =>
      text(
        await ads().postForm(`/12/accounts/${account_id}/web_event_tags`, {
          name,
          type: type ?? "SITE_VISIT",
          click_window: click_window ?? 7,
          view_through_window: view_through_window ?? 7,
          retargeting_enabled: retargeting_enabled ?? false,
        }),
      ),
  );

  server.registerTool(
    "x_ads_update_pixel",
    {
      title: "Update X Pixel",
      description: "Partial update of name, windows, or retargeting on a web event tag. Only fields the user named.",
      inputSchema: z.object({
        account_id: accountId,
        web_event_tag_id: z.string(),
        name: z.string().optional(),
        click_window: windowDays.optional(),
        view_through_window: windowDays.optional(),
        retargeting_enabled: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, web_event_tag_id, name, click_window, view_through_window, retargeting_enabled }) =>
      text(
        await ads().putForm(`/12/accounts/${account_id}/web_event_tags/${web_event_tag_id}`, {
          name,
          click_window,
          view_through_window,
          retargeting_enabled,
        }),
      ),
  );

  server.registerTool(
    "x_ads_delete_pixel",
    {
      title: "Delete X Pixel",
      description: "Delete a web event tag. Conversion tracking for that event stops. confirm=true after the user named it.",
      inputSchema: z.object({
        account_id: accountId,
        web_event_tag_id: z.string(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ account_id, web_event_tag_id, confirm }) => {
      assertNamedMutation(confirm, `Deleting pixel ${web_event_tag_id} is destructive.`);
      return text(await ads().delete(`/12/accounts/${account_id}/web_event_tags/${web_event_tag_id}`));
    },
  );
}
