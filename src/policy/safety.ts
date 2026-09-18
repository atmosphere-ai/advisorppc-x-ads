import { PolicyError } from "../ads/errors.js";

export const LIVE_STATUSES = new Set(["ACTIVE"]);

export type SpendIntent = {
  entity_status?: string;
  confirm_spend?: boolean;
};

export function normalizeCreateStatus(input: SpendIntent): "PAUSED" | "ACTIVE" | "DRAFT" {
  const status = (input.entity_status ?? "PAUSED").toUpperCase();
  if (status === "DRAFT") return "DRAFT";
  if (status === "ACTIVE") {
    assertSpendConfirmed(input, "Creating an ACTIVE campaign/ad group starts spend.");
    return "ACTIVE";
  }
  return "PAUSED";
}

export function assertSpendConfirmed(input: SpendIntent, action: string): void {
  if (process.env.X_ADS_ALLOW_UNCONFIRMED_SPEND === "1") return;
  if (input.confirm_spend === true) return;
  throw new PolicyError(
    `${action} Pass confirm_spend=true only after the user explicitly asked to start spending. Creates default to PAUSED.`,
  );
}

export function assertNamedMutation(confirm: boolean | undefined, action: string): void {
  if (process.env.X_ADS_ALLOW_UNCONFIRMED_SPEND === "1") return;
  if (confirm === true) return;
  throw new PolicyError(
    `${action} Pass confirm=true only after the user named the exact entity and the action (pause/resume/delete).`,
  );
}

export function refuseInventedBudget(budget: unknown, field: string): void {
  if (budget === undefined || budget === null || budget === "") return;
  // Presence is allowed only if the caller supplied it — the agent prompt
  // forbids inventing it. Runtime just type-checks.
  if (typeof budget !== "number" && typeof budget !== "string") {
    throw new PolicyError(`${field} must be a number in local micro-units.`);
  }
}

export const CREATIVE_SUBSTITUTION_BAN =
  "If the intended creative failed to upload or process, STOP. Do not promote a still, a source image, or a pre-existing library asset.";

export const NO_SCHEDULE =
  "X Ads API has no native schedule. Use AdvisorPPC x_ads_schedule_* tools — never invent a go-live time outside the job store. Digests never auto-resume spend.";

