export const SCHEDULER_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AdvisorPPC · Ads scheduler</title>
    <style>
      :root { --bg:#101214; --panel:#1a1d21; --line:#2a2f36; --text:#f4f6f8; --muted:#9aa3ad; --accent:#7ad7ff; --ok:#8cff7a; --danger:#ff6b6b; }
      * { box-sizing: border-box; }
      body { margin:0; font:13px/1.45 ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--text); padding:16px; }
      h1 { font-size:16px; margin:0 0 4px; }
      p.sub { margin:0 0 16px; color:var(--muted); }
      .row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
      .pill { border:1px solid var(--line); background:var(--panel); border-radius:999px; padding:4px 10px; color:var(--muted); }
      .pill b { color:var(--accent); }
      .on { color:var(--ok); } .off { color:var(--danger); }
      table { width:100%; border-collapse:collapse; margin-bottom:16px; }
      th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
      th { color:var(--muted); font-size:11px; text-transform:uppercase; font-weight:500; }
      pre { background:var(--panel); border:1px solid var(--line); padding:10px; overflow:auto; max-height:200px; border-radius:8px; }
    </style>
  </head>
  <body>
    <h1>AdvisorPPC ads scheduler</h1>
    <p class="sub">X Ads has no native schedule. This queue + agents run in the AdvisorPPC worker and work with Claude, ChatGPT, Cursor, or Grok. Digests never auto-resume spend.</p>
    <div class="row" id="meta"></div>
    <div id="agents"></div>
    <div id="jobs"></div>
    <pre id="raw">Waiting for tool result…</pre>
    <script>
      function sc(payload) { return payload?.structuredContent || payload; }
      function render(payload) {
        document.getElementById("raw").textContent = JSON.stringify(payload, null, 2);
        const d = sc(payload);
        const running = d.running ? "on" : "off";
        document.getElementById("meta").innerHTML =
          '<span class="pill">worker <b class="' + running + '">' + (d.running ? "running" : "stopped") + "</b></span>" +
          (d.jobs_path ? '<span class="pill">store <b>' + d.jobs_path + "</b></span>" : "") +
          (d.settings && d.settings.timezone ? '<span class="pill">tz <b>' + d.settings.timezone + "</b></span>" : "");
        const agents = d.agents || (d.state) || {};
        const catalog = d.catalog || [];
        const rows = catalog.length ? catalog.map((c) => {
          const st = agents[c.id] || {};
          return { id: c.id, title: c.title || c.id, enabled: st.enabled ? "on" : "off", every_ms: st.every_ms || c.default_every_ms, last: st.last_run_at || "" };
        }) : Object.keys(agents).map((id) => ({ id, title: id, enabled: agents[id].enabled ? "on" : "off", every_ms: agents[id].every_ms, last: agents[id].last_run_at || "" }));
        if (rows.length) {
          document.getElementById("agents").innerHTML = "<table><thead><tr><th>agent</th><th>enabled</th><th>every</th><th>last run</th></tr></thead><tbody>" +
            rows.map((r) => "<tr><td>" + r.title + "</td><td class='" + r.enabled + "'>" + r.enabled + "</td><td>" + r.every_ms + "</td><td>" + r.last + "</td></tr>").join("") +
            "</tbody></table>";
        }
        const jobs = d.jobs || [];
        if (jobs.length) {
          document.getElementById("jobs").innerHTML = "<table><thead><tr><th>job</th><th>status</th><th>run_at</th><th>tool</th></tr></thead><tbody>" +
            jobs.slice(0, 30).map((j) => "<tr><td>" + (j.name || j.id.slice(0,8)) + "</td><td>" + j.status + "</td><td>" + (j.run_at || "") + "</td><td>" + (j.action && j.action.tool || "") + "</td></tr>").join("") +
            "</tbody></table>";
        }
      }
      window.addEventListener("message", (ev) => {
        const d = ev.data;
        if (!d) return;
        if (d.type === "ui/notifications/tool-result" || d.method === "ui/notifications/tool-result") render(d.params || d.result || d);
        else if (d.result || d.structuredContent || d.jobs || d.agents) render(d.result || d);
      });
      window.parent && window.parent.postMessage({ jsonrpc: "2.0", method: "ui/initialize", params: {} }, "*");
    </script>
  </body>
</html>
`;
