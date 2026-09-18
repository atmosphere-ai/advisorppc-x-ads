import { AdsApiError, ConfigError } from "./errors.js";

export type Json = Record<string, unknown>;

export type AdsListResponse<T = Json> = {
  data: T[];
  next_cursor?: string | null;
  request?: unknown;
};

export type AdsClientOptions = {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

function encodeQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) params.set(k, v.join(","));
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function formBody(fields: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) params.set(k, v.join(","));
    else if (typeof v === "boolean") params.set(k, v ? "true" : "false");
    else params.set(k, String(v));
  }
  return params.toString();
}

export class AdsClient {
  readonly accessToken: string;
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(opts: AdsClientOptions) {
    if (!opts.accessToken) {
      throw new ConfigError(
        "Missing X Ads access token. Set X_ADS_ACCESS_TOKEN or pass Authorization: Bearer.",
      );
    }
    this.accessToken = opts.accessToken;
    this.baseUrl = (opts.baseUrl ?? "https://ads-api.x.com").replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  async postForm<T = unknown>(path: string, fields: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, {
      body: formBody(fields),
      contentType: "application/x-www-form-urlencoded",
    });
  }

  async putForm<T = unknown>(path: string, fields: Record<string, unknown>): Promise<T> {
    return this.request<T>("PUT", path, {
      body: formBody(fields),
      contentType: "application/x-www-form-urlencoded",
    });
  }

  async postJson<T = unknown>(path: string, json: unknown): Promise<T> {
    return this.request<T>("POST", path, {
      body: JSON.stringify(json),
      contentType: "application/json",
    });
  }

  async delete<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }

  async listAll<T = Json>(
    path: string,
    query: Record<string, unknown> = {},
    { maxPages = 10 }: { maxPages?: number } = {},
  ): Promise<T[]> {
    const out: T[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const page = await this.get<AdsListResponse<T>>(path, { ...query, cursor });
      const rows = page.data ?? [];
      out.push(...rows);
      const next = page.next_cursor;
      if (!next) break;
      cursor = next;
    }
    return out;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: string; contentType?: string } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${encodeQuery(opts.query)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = opts.contentType ?? "application/json";
    }
    const res = await this.fetchImpl(url, { method, headers, body: opts.body });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }
    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === "object" && "detail" in parsed
          ? String((parsed as Json).detail)
          : null) ||
        (parsed && typeof parsed === "object" && "errors" in parsed
          ? JSON.stringify((parsed as Json).errors)
          : null) ||
        text.slice(0, 400) ||
        res.statusText;
      throw new AdsApiError(res.status, `Ads API ${method} ${path} → ${res.status}: ${msg}`, parsed);
    }
    return parsed as T;
  }
}

export function tokenFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.X_ADS_ACCESS_TOKEN ||
    env.X_BEARER_TOKEN ||
    env.TWITTER_BEARER_TOKEN ||
    ""
  );
}
