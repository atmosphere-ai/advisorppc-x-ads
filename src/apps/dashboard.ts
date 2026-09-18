export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AdvisorPPC · X Ads</title>
    <style>
      :root { --bg:#101214; --panel:#1a1d21; --line:#2a2f36; --text:#f4f6f8; --muted:#9aa3ad; --accent:#8cff7a; --danger:#ff6b6b; }
      * { box-sizing: border-box; }
      body { margin:0; font:13px/1.45 ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--text); padding:16px; }
      h1 { font-size:16px; margin:0 0 4px; letter-spacing:-0.02em; }
      p.sub { margin:0 0 16px; color:var(--muted); }
      .row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
      .pill { border:1px solid var(--line); background:var(--panel); border-radius:999px; padding:4px 10px; color:var(--muted); }
      .pill b { color:var(--accent); font-weight:600; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); }
      th { color:var(--muted); font-weight:500; font-size:11px; text-transform:uppercase; }
      .on { color:var(--accent); } .off { color:var(--danger); }
      pre { background:var(--panel); border:1px solid var(--line); padding:10px; overflow:auto; max-height:240px; border-radius:8px; }
    </style>
  </head>
  <body>
    <h1>AdvisorPPC X Ads</h1>
    <p class="sub">Inline dashboard (MCP Apps). Hosts without Apps still get the JSON tool result.</p>
    <div class="row" id="meta"></div>
    <div id="table"></div>
    <pre id="raw">Waiting for tool result…</pre>
    <script>
      function render(payload) {
        const raw = document.getElementById("raw");
        raw.textContent = JSON.stringify(payload, null, 2);
        const data = payload?.data || payload?.structuredContent?.data || payload;
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        document.getElementById("meta").innerHTML = '<span class="pill">rows <b>' + rows.length + "</b></span>";
        if (!rows.length) {
          document.getElementById("table").innerHTML = "<p class='sub'>No rows in this result.</p>";
          return;
        }
        const keys = ["id","name","entity_status","objective","approval_status"];
        const present = keys.filter((k) => rows.some((r) => r && r[k] != null));
        const head = present.map((k) => "<th>" + k + "</th>").join("");
        const body = rows.map((r) => "<tr>" + present.map((k) => {
          const v = r[k] == null ? "" : String(r[k]);
          const cls = v === "ACTIVE" ? "on" : (v === "PAUSED" || v === "DRAFT") ? "off" : "";
          return "<td class='" + cls + "'>" + v + "</td>";
        }).join("") + "</tr>").join("");
        document.getElementById("table").innerHTML = "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
      }
      window.addEventListener("message", (ev) => {
        const d = ev.data;
        if (!d) return;
        if (d.type === "ui/notifications/tool-result" || d.method === "ui/notifications/tool-result") render(d.params || d.result || d);
        else if (d.result || d.data) render(d.result || d);
      });
      window.parent && window.parent.postMessage({ jsonrpc: "2.0", method: "ui/initialize", params: {} }, "*");
    </script>
  </body>
</html>
`;
