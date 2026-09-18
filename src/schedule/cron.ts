/** Minimal 5-field cron (UTC or IANA tz). Supports *, lists, ranges, and /steps. */

export type Cron = {
  minute: Set<number>;
  hour: Set<number>;
  day: Set<number>;
  month: Set<number>;
  weekday: Set<number>;
};

function parseField(raw: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  const add = (n: number) => {
    if (n < min || n > max) throw new Error(`cron field ${n} out of range ${min}-${max}`);
    out.add(n);
  };
  for (const part of raw.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad cron step in ${raw}`);
    if (range === "*") {
      for (let n = min; n <= max; n += step) add(n);
      continue;
    }
    const [a, b] = range!.split("-").map(Number);
    if (b === undefined) {
      add(a!);
      continue;
    }
    if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error(`bad cron range ${range}`);
    for (let n = a!; n <= b; n += step) add(n);
  }
  return out;
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("cron must have 5 fields: m h dom mon dow");
  return {
    minute: parseField(parts[0]!, 0, 59),
    hour: parseField(parts[1]!, 0, 23),
    day: parseField(parts[2]!, 1, 31),
    month: parseField(parts[3]!, 1, 12),
    weekday: parseField(parts[4]!, 0, 6),
  };
}

type Parts = { minute: number; hour: number; day: number; month: number; weekday: number; year: number };

function zonedParts(date: Date, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday ?? "Sun");
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    minute: Number(map.minute),
    hour,
    day: Number(map.day),
    month: Number(map.month),
    weekday: wd < 0 ? 0 : wd,
    year: Number(map.year),
  };
}

export function cronMatches(date: Date, cron: Cron, tz = "UTC"): boolean {
  const p = zonedParts(date, tz);
  return (
    cron.minute.has(p.minute) &&
    cron.hour.has(p.hour) &&
    cron.day.has(p.day) &&
    cron.month.has(p.month) &&
    cron.weekday.has(p.weekday)
  );
}

/** Next matching minute strictly after `from`. */
export function nextCronAfter(from: Date, expr: string, tz = "UTC"): Date {
  const cron = parseCron(expr);
  const start = new Date(from.getTime());
  start.setUTCSeconds(0, 0);
  const cursor = new Date(start.getTime() + 60_000);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (cronMatches(cursor, cron, tz)) return new Date(cursor);
    cursor.setTime(cursor.getTime() + 60_000);
  }
  throw new Error(`no cron match for "${expr}" in the next year`);
}

export function nextEvery(from: Date, everyMs: number): Date {
  if (everyMs < 60_000) throw new Error("every_ms must be at least 60 seconds");
  return new Date(from.getTime() + everyMs);
}
