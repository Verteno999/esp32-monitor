const express = require("express");
const app = express();
app.use(express.json());

// Secret key the ESP32 must send. Set API_KEY in Render > Environment.
const API_KEY = process.env.API_KEY || "change-me";

// Latest reading is kept in memory (fine while the server stays awake)
let latest = { temp: null, dust: null, receivedAt: null };

// Server's own clock, shown as UTC+7 (Asia/Bangkok)
function bangkokTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(",", "");
}

function dustLabel(ug) {
  if (ug < 35) return "Good";
  if (ug < 75) return "Moderate";
  if (ug < 150) return "High";
  return "Very high";
}

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
  res.json({ ok: true });
});

// Web page polls this
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

app.get("/health", (req, res) => res.send("ok"));

const PAGE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 Monitor</title>
<style>
  body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:16px;text-align:center}
  h1{font-size:20px;color:#aaa;font-weight:500}
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
<div id="status" class="off">Connecting...</div>
<div class="card"><div class="label">Temperature</div>
  <div class="val"><span id="t">--</span><span class="unit"> °C</span></div></div>
<div class="card"><div class="label">Dust level</div>
  <div class="val"><span id="d">--</span><span class="unit"> µg/m³</span></div>
  <div class="sub" id="dl">--</div></div>
<div class="card"><div class="label">Time (UTC+7)</div>
  <div class="val" style="font-size:30px" id="tm">--</div></div>
<script>
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

app.get("/", (req, res) => res.send(PAGE));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
