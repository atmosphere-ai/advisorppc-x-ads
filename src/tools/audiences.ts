import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { hashUser } from "../ads/hash.js";
import { assertNamedMutation } from "../policy/safety.js";
import { accountId, text, type ClientFactory, UI_META } from "./common.js";

const userRow = z.object({
  email: z.union([z.string(), z.array(z.string())]).optional(),
  phone: z.union([z.string(), z.array(z.string())]).optional(),
  phone_number: z.union([z.string(), z.array(z.string())]).optional(),
  handle: z.union([z.string(), z.array(z.string())]).optional(),
  twitter_id: z.union([z.string(), z.array(z.string())]).optional(),
  device_id: z.union([z.string(), z.array(z.string())]).optional(),
});

export function registerAudienceTools(server: McpServer, getClient: ClientFactory): void {
  const ads = () => getClient();

  server.registerTool(
    "x_ads_create_audience",
    {
      title: "Create custom audience",
      description:
        "Create an empty CRM custom audience. Then load members with x_ads_audience_users (SHA-256 hashed). Name must come from the user. targetable stays false until it is large enough.",
      inputSchema: z.object({
        account_id: accountId,
        name: z.string(),
        description: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, name, description }) =>
      text(await ads().postForm(`/12/accounts/${account_id}/custom_audiences`, { name, description })),
  );

  server.registerTool(
    "x_ads_update_audience",
    {
      title: "Update custom audience",
      description: "Rename or change description of a custom audience. Only fields the user named.",
      inputSchema: z.object({
        account_id: accountId,
        custom_audience_id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, custom_audience_id, name, description }) =>
      text(
        await ads().putForm(`/12/accounts/${account_id}/custom_audiences/${custom_audience_id}`, {
          name,
          description,
        }),
      ),
  );

  server.registerTool(
    "x_ads_delete_audience",
    {
      title: "Delete custom audience",
      description:
        "Soft-delete a custom audience. Line items targeting it will stop matching. confirm=true after the user named the audience.",
      inputSchema: z.object({
        account_id: accountId,
        custom_audience_id: z.string(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ account_id, custom_audience_id, confirm }) => {
      assertNamedMutation(confirm, `Deleting custom audience ${custom_audience_id} is destructive.`);
      return text(await ads().delete(`/12/accounts/${account_id}/custom_audiences/${custom_audience_id}`));
    },
  );

  server.registerTool(
    "x_ads_audience_users",
    {
      title: "Add/remove audience users",
      description:
        "Add (Update) or remove (Delete) members of a custom audience. Pass raw emails/phones/handles — this server SHA-256 hashes after X normalization (lowercase email, strip @, digits-only phone). Set hashed=true only if values are already hex SHA-256. Max 2500 users per call. Never log the raw list.",
      inputSchema: z.object({
        account_id: accountId,
        custom_audience_id: z.string(),
        operation: z.enum(["Update", "Delete"]).default("Update"),
        users: z.array(userRow).min(1).max(2500),
        hashed: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, custom_audience_id, operation, users, hashed }) => {
      const hashedUsers = users.map((u) => hashUser(u, hashed === true));
      if (hashedUsers.some((u) => Object.keys(u).length === 0)) {
        throw new Error("Each user needs at least one identifier (email, phone, handle, twitter_id, device_id).");
      }
      return text(
        await ads().postJson(`/12/accounts/${account_id}/custom_audiences/${custom_audience_id}/users`, [
          { operation_type: operation, params: { users: hashedUsers } },
        ]),
      );
    },
  );

  server.registerTool(
    "x_ads_audience_targeted",
    {
      title: "Where audience is targeted",
      description: "Campaigns and ad groups currently targeting a custom audience.",
      inputSchema: z.object({
        account_id: accountId,
        custom_audience_id: z.string(),
        with_active: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, custom_audience_id, with_active }) =>
      text(
        await ads().get(`/12/accounts/${account_id}/custom_audiences/${custom_audience_id}/targeted`, {
          with_active,
        }),
      ),
  );

  server.registerTool(
    "x_ads_estimate_audience",
    {
      title: "Estimate audience size",
      description:
        "Estimate reachable unique users for a targeting set BEFORE spending. criteria same shape as x_ads_add_targeting. Does not create anything.",
      inputSchema: z.object({
        account_id: accountId,
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
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, criteria }) =>
      text(
        await ads().postForm(`/12/accounts/${account_id}/audience_estimate`, {
          targeting_criteria: JSON.stringify(
            criteria.map((c) => ({
              targeting_type: c.targeting_type,
              targeting_value: c.targeting_value,
              operator_type: c.operator_type ?? "EQ",
            })),
          ),
        }),
      ),
  );

  server.registerTool(
    "x_ads_list_dnr",
    {
      title: "List Do Not Reach lists",
      description:
        "Account-level exclusion list (suppression). An account can have at most one DNR list. Excludes those users from ALL campaigns on the account; it does not strip them from custom audiences.",
      inputSchema: z.object({
        account_id: accountId,
        count: z.number().int().optional(),
        cursor: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: UI_META,
    },
    async ({ account_id, count, cursor }) =>
      text(await ads().get(`/12/accounts/${account_id}/do_not_reach_lists`, { count, cursor })),
  );

  server.registerTool(
    "x_ads_create_dnr",
    {
      title: "Create Do Not Reach list",
      description:
        "Create the account DNR (suppression) list. One per account; API names it 'Do Not Reach List'. Optional description only. Then load emails with x_ads_dnr_users.",
      inputSchema: z.object({
        account_id: accountId,
        description: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, description }) =>
      text(await ads().postForm(`/12/accounts/${account_id}/do_not_reach_lists`, { description })),
  );

  server.registerTool(
    "x_ads_delete_dnr",
    {
      title: "Delete Do Not Reach list",
      description: "Delete the account DNR list. confirm=true after the user named it. Suppression stops.",
      inputSchema: z.object({
        account_id: accountId,
        do_not_reach_list_id: z.string(),
        confirm: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ account_id, do_not_reach_list_id, confirm }) => {
      assertNamedMutation(confirm, `Deleting DNR list ${do_not_reach_list_id} is destructive.`);
      return text(await ads().delete(`/12/accounts/${account_id}/do_not_reach_lists/${do_not_reach_list_id}`));
    },
  );

  server.registerTool(
    "x_ads_dnr_users",
    {
      title: "Add/remove DNR users",
      description:
        "Add (Update) or remove (Delete) emails on the Do Not Reach list. Emails only. Raw emails are SHA-256 hashed here. hashed=true if already hex SHA-256. expires_at optional ISO 8601 (must be < 13 months).",
      inputSchema: z.object({
        account_id: accountId,
        do_not_reach_list_id: z.string(),
        operation: z.enum(["Update", "Delete"]).default("Update"),
        emails: z.array(z.string()).min(1).max(2500),
        hashed: z.boolean().optional(),
        expires_at: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ account_id, do_not_reach_list_id, operation, emails, hashed, expires_at }) => {
      const users = emails.map((email) => hashUser({ email }, hashed === true));
      return text(
        await ads().postJson(
          `/12/batch/accounts/${account_id}/do_not_reach_lists/${do_not_reach_list_id}/users`,
          [{ operation_type: operation, params: { users, expires_at } }],
        ),
      );
    },
  );
}
