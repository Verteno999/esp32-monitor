const express = require("express");
const { Pool } = require("pg");
const app = express();
app.use(express.json());

// Secret key the ESP32 must send. Set API_KEY in Render > Environment.
const API_KEY = process.env.API_KEY || "change-me";

// How often a log entry is saved (hours). Optional: set LOG_EVERY_HOURS in Render to change.
const LOG_EVERY_HOURS = Number(process.env.LOG_EVERY_HOURS) || 2;
const SLOT_MS = LOG_EVERY_HOURS * 3600 * 1000;
const BKK_OFFSET_MS = 7 * 3600 * 1000; // UTC+7 (Asia/Bangkok)

// App icons (generated), embedded so server.js stays a single file
const ICON_192 = Buffer.from("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", "base64");
const ICON_512 = Buffer.from("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", "base64");

// ---------- Log storage (Postgres, e.g. Neon) ----------
// Set DATABASE_URL in Render > Environment to your database connection string.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    })
  : null;

if (pool) {
  // Free databases go to sleep and drop connections; don't crash on that.
  pool.on("error", (e) => console.error("DB connection error:", e.message));
} else {
  console.log("DATABASE_URL not set: logs are kept in memory only (lost on restart)");
}

const memLogs = []; // fallback when there is no database
let dbReady = false;

async function ensureDb() {
  if (!pool || dbReady) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS readings (" +
      "id SERIAL PRIMARY KEY, " +
      "slot BIGINT UNIQUE NOT NULL, " +
      "ts TIMESTAMPTZ NOT NULL DEFAULT now(), " +
      "temp REAL, dust REAL)"
  );
  dbReady = true;
}

// One log entry per time slot (2 hours, aligned to Bangkok time).
// The UNIQUE slot column stops duplicates, even after a restart.
let lastSlotTried = null;
async function maybeLog(temp, dust) {
  const slot = Math.floor((Date.now() + BKK_OFFSET_MS) / SLOT_MS);
  if (slot === lastSlotTried) return;
  lastSlotTried = slot;
  try {
    if (pool) {
      await ensureDb();
      await pool.query(
        "INSERT INTO readings (slot, temp, dust) VALUES ($1, $2, $3) ON CONFLICT (slot) DO NOTHING",
        [slot, temp, dust]
      );
    } else if (!memLogs.some((r) => r.slot === slot)) {
      memLogs.push({ slot, ts: new Date().toISOString(), temp, dust });
      if (memLogs.length > 1000) memLogs.shift();
    }
    console.log("Logged slot " + slot + ": " + temp + " C, " + dust + " ug/m3");
  } catch (e) {
    console.error("Log failed:", e.message);
    lastSlotTried = null; // try again on the next reading
  }
}

async function getLogs(hours) {
  const since = hours ? new Date(Date.now() - hours * 3600 * 1000) : new Date(0);
  if (pool) {
    await ensureDb();
    const r = await pool.query(
      "SELECT ts, temp, dust FROM readings WHERE ts >= $1 ORDER BY ts ASC LIMIT 5000",
      [since]
    );
    return r.rows.map((x) => ({ ts: new Date(x.ts).toISOString(), temp: x.temp, dust: x.dust }));
  }
  return memLogs
    .filter((x) => new Date(x.ts) >= since)
    .map((x) => ({ ts: x.ts, temp: x.temp, dust: x.dust }));
}

function parseHours(q, def) {
  const h = Number(q);
  if (q === undefined || q === "" || !Number.isFinite(h) || h < 0) return def;
  return h; // 0 means all
}

// ---------- Helpers ----------
// Server's own clock, shown as UTC+7 (Asia/Bangkok)
function bangkokTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(",", "");
}

function bangkokIso(d) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

function dustLabel(ug) {
  if (ug < 35) return "Good";
  if (ug < 75) return "Moderate";
  if (ug < 150) return "High";
  return "Very high";
}

// Latest reading is kept in memory (fine while the server stays awake)
let latest = { temp: null, dust: null, receivedAt: null };

// ---------- API ----------
// ESP32 sends data here
app.post("/api/data", (req, res) => {
  if (req.get("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "bad key" });
  }
  const temp = Number(req.body.temp);
  const dust = Number(req.body.dust);
  if (!Number.isFinite(temp) || !Number.isFinite(dust)) {
    return res.status(400).json({ error: "temp and dust must be numbers" });
  }
  latest = { temp, dust, receivedAt: Date.now() };
  maybeLog(temp, dust); // saves only once per time slot
  res.json({ ok: true });
});

// Live page polls this
app.get("/api/latest", (req, res) => {
  const age = latest.receivedAt ? (Date.now() - latest.receivedAt) / 1000 : null;
  res.set("Cache-Control", "no-store");
  res.json({
    temp: latest.temp,
    dust: latest.dust,
    dust_label: latest.dust === null ? "--" : dustLabel(latest.dust),
    time: bangkokTime(),
    online: age !== null && age < 20, // ESP32 counts as offline after 20 s of silence
    age_seconds: age === null ? null : Math.round(age),
  });
});

// Dashboard reads the log from here (?hours=24, 168, 720, or 0 for all)
app.get("/api/logs", async (req, res) => {
  try {
    const rows = await getLogs(parseHours(req.query.hours, 168));
    res.set("Cache-Control", "no-store");
    res.json({ storage: pool ? "database" : "memory", rows });
  } catch (e) {
    console.error("getLogs failed:", e.message);
    res.status(500).json({ error: "could not read the log database" });
  }
});

// Download everything as CSV (opens in Excel / Google Sheets)
app.get("/api/logs.csv", async (req, res) => {
  try {
    const rows = await getLogs(parseHours(req.query.hours, 0));
    const lines = ["time_utc+7,temp_c,dust_ugm3"].concat(
      rows.map((r) => bangkokIso(new Date(r.ts)) + "," + (r.temp === null ? "" : r.temp) + "," + (r.dust === null ? "" : r.dust))
    );
    res.type("text/csv").set("Content-Disposition", "attachment; filename=esp32-log.csv").send(lines.join("\n") + "\n");
  } catch (e) {
    console.error("csv failed:", e.message);
    res.status(500).send("could not read the log database");
  }
});

app.get("/health", (req, res) => res.send("ok"));

// ---------- App (PWA) files ----------
app.get("/manifest.webmanifest", (req, res) => {
  res.type("application/manifest+json").json({
    name: "ESP32 Monitor",
    short_name: "ESP32",
    description: "Temperature and dust level from my ESP32",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  });
});

app.get("/icon-192.png", (req, res) => res.type("image/png").send(ICON_192));
app.get("/icon-512.png", (req, res) => res.type("image/png").send(ICON_512));

// Minimal service worker (makes the page installable; always uses the network)
app.get("/sw.js", (req, res) => {
  res.type("application/javascript").set("Cache-Control", "no-cache").send(
    "self.addEventListener('install', () => self.skipWaiting());\n" +
    "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));\n" +
    "self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });\n"
  );
});

// ---------- Pages ----------
const PAGE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#111111">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-192.png">
<title>ESP32 Monitor</title>
<style>
  body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:16px;text-align:center}
  h1{font-size:20px;color:#aaa;font-weight:500;margin-bottom:6px}
  a.link{color:#8ab4f8;font-size:15px;text-decoration:none}
  .card{background:#1e1e1e;border-radius:16px;padding:20px;margin:14px auto;max-width:420px}
  .label{color:#999;font-size:14px}
  .val{font-size:48px;font-weight:600;margin-top:6px}
  .unit{font-size:20px;color:#999}
  .sub{font-size:16px;color:#8ab4f8;margin-top:4px}
  #status{font-size:14px;margin-top:8px}
  .on{color:#6fcf97} .off{color:#eb5757}
</style>
</head>
<body>
<h1>ESP32 Monitor</h1>
<a class="link" href="/dashboard">Log dashboard &rarr;</a>
<div id="status" class="off">Connecting...</div>
<div class="card"><div class="label">Temperature</div>
  <div class="val"><span id="t">--</span><span class="unit"> °C</span></div></div>
<div class="card"><div class="label">Dust level</div>
  <div class="val"><span id="d">--</span><span class="unit"> µg/m³</span></div>
  <div class="sub" id="dl">--</div></div>
<div class="card"><div class="label">Time (UTC+7)</div>
  <div class="val" style="font-size:30px" id="tm">--</div></div>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function(){});
}
async function update(){
  try{
    const r = await fetch('/api/latest', {cache:'no-store'});
    const j = await r.json();
    document.getElementById('t').textContent  = j.temp === null ? '--' : j.temp.toFixed(1);
    document.getElementById('d').textContent  = j.dust === null ? '--' : j.dust.toFixed(0);
    document.getElementById('dl').textContent = j.dust_label;
    document.getElementById('tm').textContent = j.time;
    const s = document.getElementById('status');
    if (j.online) { s.textContent = 'ESP32 online'; s.className = 'on'; }
    else { s.textContent = j.age_seconds === null ? 'Waiting for ESP32...' : 'ESP32 offline (last data ' + j.age_seconds + ' s ago)'; s.className = 'off'; }
  }catch(e){
    const s = document.getElementById('status');
    s.textContent = 'Server not reachable'; s.className = 'off';
  }
}
update(); setInterval(update, 1000);
</script>
</body>
</html>`;

// String.raw so nothing inside the page script is changed by the server
const DASH = String.raw`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#111111">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-192.png">
<title>ESP32 Log</title>
<style>
  body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:16px;text-align:center}
  h1{font-size:20px;color:#aaa;font-weight:500;margin-bottom:6px}
  a.link{color:#8ab4f8;font-size:15px;text-decoration:none}
  .btns{margin:14px 0 4px}
  .btns button{background:#1e1e1e;color:#ccc;border:1px solid #333;border-radius:20px;padding:8px 16px;margin:0 3px;font-size:14px}
  .btns button.active{background:#8ab4f8;color:#111;border-color:#8ab4f8}
  .msg{color:#eb9b5b;font-size:14px;min-height:18px;margin:8px auto;max-width:420px}
  .card{background:#1e1e1e;border-radius:16px;padding:16px;margin:14px auto;max-width:560px;text-align:left}
  .label{color:#999;font-size:14px}
  .stat{color:#8ab4f8;font-size:14px;margin:4px 0 8px}
  .chartbox{position:relative;height:220px}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px}
  th{color:#999;font-weight:500;text-align:left;padding:6px 4px;border-bottom:1px solid #333}
  td{padding:6px 4px;border-bottom:1px solid #262626}
</style>
</head>
<body>
<h1>ESP32 Log Dashboard</h1>
<a class="link" href="/">&larr; Live view</a>
<div class="btns">
  <button data-r="24h" onclick="load('24h')">24 h</button>
  <button data-r="7d" onclick="load('7d')">7 days</button>
  <button data-r="30d" onclick="load('30d')">30 days</button>
  <button data-r="all" onclick="load('all')">All</button>
</div>
<div class="msg" id="msg"></div>
<div class="card"><div class="label">Temperature (°C)</div>
  <div class="stat" id="tstat">--</div>
  <div class="chartbox"><canvas id="tchart"></canvas></div></div>
<div class="card"><div class="label">Dust level (µg/m³)</div>
  <div class="stat" id="dstat">--</div>
  <div class="chartbox"><canvas id="dchart"></canvas></div></div>
<div class="card"><div class="label" style="margin-bottom:8px">Latest log entries</div>
  <table id="tbl"></table>
  <a class="link" href="/api/logs.csv">Download all as CSV</a></div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function(){});
}
var RANGES = {"24h": 24, "7d": 168, "30d": 720, "all": 0};
var tChart = null, dChart = null;

function bkk(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok", hourCycle: "h23",
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
  }).replace(",", "");
}

function stats(arr) {
  var v = arr.filter(function (x) { return x !== null && isFinite(x); });
  if (!v.length) return null;
  var sum = 0, mn = v[0], mx = v[0];
  v.forEach(function (x) { sum += x; if (x < mn) mn = x; if (x > mx) mx = x; });
  return { avg: sum / v.length, min: mn, max: mx };
}

function fmtStat(s, d) {
  if (!s) return "--";
  return "avg " + s.avg.toFixed(d) + " | min " + s.min.toFixed(d) + " | max " + s.max.toFixed(d);
}

function makeChart(old, id, labels, data, color) {
  if (old) old.destroy();
  if (typeof Chart === "undefined") return null;
  return new Chart(document.getElementById(id), {
    type: "line",
    data: { labels: labels, datasets: [{ data: data, borderColor: color, backgroundColor: color,
      tension: 0.25, pointRadius: 3, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#999", maxTicksLimit: 6, maxRotation: 0 }, grid: { color: "#2a2a2a" } },
        y: { ticks: { color: "#999" }, grid: { color: "#2a2a2a" } }
      }
    }
  });
}

function render(rows) {
  var labels = rows.map(function (r) { return bkk(r.ts); });
  var temps = rows.map(function (r) { return r.temp; });
  var dusts = rows.map(function (r) { return r.dust; });
  tChart = makeChart(tChart, "tchart", labels, temps, "#6fcf97");
  dChart = makeChart(dChart, "dchart", labels, dusts, "#8ab4f8");
  document.getElementById("tstat").textContent = fmtStat(stats(temps), 1);
  document.getElementById("dstat").textContent = fmtStat(stats(dusts), 0);
  var html = "<tr><th>Time (UTC+7)</th><th>Temp °C</th><th>Dust µg/m³</th></tr>";
  rows.slice(-24).reverse().forEach(function (r) {
    html += "<tr><td>" + bkk(r.ts) + "</td><td>" + (r.temp === null ? "--" : r.temp.toFixed(1)) +
            "</td><td>" + (r.dust === null ? "--" : r.dust.toFixed(0)) + "</td></tr>";
  });
  document.getElementById("tbl").innerHTML = html;
}

async function load(range) {
  document.querySelectorAll(".btns button").forEach(function (b) {
    b.className = (b.getAttribute("data-r") === range) ? "active" : "";
  });
  var msg = document.getElementById("msg");
  msg.textContent = "Loading...";
  try {
    var r = await fetch("/api/logs?hours=" + RANGES[range], { cache: "no-store" });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || "server error");
    render(j.rows);
    var note = "";
    if (!j.rows.length) note = "No logs yet. The first log is saved when the ESP32 sends data.";
    else if (typeof Chart === "undefined") note = "Charts could not load (needs internet). The table below still works.";
    if (j.storage === "memory") note += " Warning: no database connected, so logs are lost when the server restarts.";
    msg.textContent = note;
  } catch (e) {
    msg.textContent = "Could not load logs: " + e.message;
  }
}
load("7d");
</script>
</body>
</html>`;

app.get("/", (req, res) => res.send(PAGE));
app.get("/dashboard", (req, res) => res.send(DASH));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
