#!/usr/bin/env node
/**
 * Streamable HTTP entry (MCP 2026-07-28).
 * POST JSON-RPC to /mcp. Optional Authorization: Bearer overrides env token.
 */
import { createServer as createHttpServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { AdsClient, tokenFromEnv } from "./ads/client.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT || 3333);
const HOST = process.env.HOST || "127.0.0.1";
const PATH = process.env.MCP_PATH || "/mcp";

function tokenFromRequest(req: Request): string {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return tokenFromEnv();
}

async function toWebRequest(req: import("node:http").IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `${HOST}:${PORT}`;
  const url = `http://${host}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  return new Request(url, { method, headers, body });
}

async function main() {
  const handler = createMcpHandler(
    (ctx) => {
      const token =
        ctx.authInfo?.token ||
        (ctx.requestInfo ? tokenFromRequest(ctx.requestInfo) : tokenFromEnv());
      return createServer({
        accessToken: token,
        client: token ? new AdsClient({ accessToken: token }) : undefined,
      });
    },
    { responseMode: "json" },
  );

  const http = createHttpServer(async (req, res) => {
    const path = req.url?.split("?")[0];
    if (path === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "advisorppc-x-ads" }));
      return;
    }
    if (path !== PATH) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    try {
      const request = await toWebRequest(req);
      const token = tokenFromRequest(request);
      const response = await handler.fetch(request, {
        authInfo: token
          ? { token, clientId: "advisorppc-x-ads", scopes: ["ads.read", "ads.write"] }
          : undefined,
      });
      const outHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        outHeaders[k] = v;
      });
      res.writeHead(response.status, outHeaders);
      const buf = Buffer.from(await response.arrayBuffer());
      res.end(buf);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end("internal error");
    }
  });

  http.listen(PORT, HOST, () => {
    console.error(`advisorppc-x-ads MCP HTTP on http://${HOST}:${PORT}${PATH}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
