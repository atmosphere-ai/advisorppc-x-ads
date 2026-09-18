/** 1 unit of account currency = 1_000_000 micro-units. $50.00 → 50_000_000. */
export const MICRO = 1_000_000;

export function toMicro(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error("amount must be a finite number");
  return Math.round(amount * MICRO);
}

export function fromMicro(micro: number | string | null | undefined): number | null {
  if (micro === null || micro === undefined || micro === "") return null;
  const n = typeof micro === "string" ? Number(micro) : micro;
  if (!Number.isFinite(n)) return null;
  return n / MICRO;
}

export function formatMoney(
  micro: number | string | null | undefined,
  currency = "USD",
): string {
  const units = fromMicro(micro);
  if (units === null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(units);
  } catch {
    return `${units.toFixed(2)} ${currency}`;
  }
}
