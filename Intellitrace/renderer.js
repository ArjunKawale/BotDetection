/* renderer.js — runs in the BrowserWindow (renderer process) */

// ── STATE ─────────────────────────────────────────────────────────────────────

let settings = { apiUrl: "http://localhost:8000", apiKey: "" };
let scanning  = false;

// ── ELEMENTS ──────────────────────────────────────────────────────────────────

const usernameInput  = document.getElementById("username-input");
const scanBtn        = document.getElementById("scan-btn");
const emptyState     = document.getElementById("empty-state");
const logPanel       = document.getElementById("log-panel");
const resultPanel    = document.getElementById("result-panel");
const settingsOverlay= document.getElementById("settings-overlay");
const settingsToggle = document.getElementById("settings-toggle");
const settingsSave   = document.getElementById("settings-save");
const settingsCancel = document.getElementById("settings-cancel");
const cfgUrl         = document.getElementById("cfg-url");
const cfgKey         = document.getElementById("cfg-key");

const stages = {
  scraping:  document.querySelector('[data-stage="scraping"]'),
  ideology:  document.querySelector('[data-stage="ideology"]'),
  aigen:     document.querySelector('[data-stage="aigen"]'),
  frequency: document.querySelector('[data-stage="frequency"]'),
  rhythm:    document.querySelector('[data-stage="rhythm"]'),
  done:      document.querySelector('[data-stage="done"]'),
};

// ── INIT ──────────────────────────────────────────────────────────────────────

(async () => {
  settings = await electronAPI.loadSettings();
  cfgUrl.value = settings.apiUrl;
  cfgKey.value = settings.apiKey;
})();

// ── HELPERS ───────────────────────────────────────────────────────────────────

function setStage(name, state) {
  const el = stages[name];
  if (!el) return;
  el.classList.remove("active", "done", "error");
  if (state) el.classList.add(state);
}

function resetAllStages() {
  Object.keys(stages).forEach((k) => setStage(k, null));
}

function showPanel(which) {
  emptyState.style.display   = "none";
  logPanel.classList.remove("visible");
  resultPanel.classList.remove("visible");
  if (which === "log")    logPanel.classList.add("visible");
  if (which === "result") resultPanel.classList.add("visible");
  if (which === "empty")  emptyState.style.display = "flex";
}

function log(text, type = "info") {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  const line = document.createElement("div");
  line.className = `log-line log-${type}`;
  line.innerHTML = `<span class="log-ts">[${ts}]</span><span>${escHtml(text)}</span>`;
  logPanel.appendChild(line);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function pct(v) { return `${Math.round(v * 100)}%`; }

function probColor(v) {
  // gradient: green → amber → red
  if (v < 0.35) return "var(--green)";
  if (v < 0.6)  return "var(--accent)";
  return "var(--red)";
}

function setBusy(busy) {
  scanning = busy;
  scanBtn.disabled = busy;
  usernameInput.disabled = busy;
  scanBtn.textContent = busy ? "⏳ Scanning…" : "⬡ Run Analysis";
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

settingsToggle.addEventListener("click", () => {
  settingsOverlay.classList.add("visible");
});
settingsCancel.addEventListener("click", () => {
  settingsOverlay.classList.remove("visible");
});
settingsSave.addEventListener("click", async () => {
  settings.apiUrl = cfgUrl.value.replace(/\/$/, "");
  settings.apiKey = cfgKey.value;
  await electronAPI.saveSettings(settings);
  settingsOverlay.classList.remove("visible");
  log("Settings saved.", "ok");
});

// ── SCAN FLOW ─────────────────────────────────────────────────────────────────

scanBtn.addEventListener("click", startScan);
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startScan();
});

async function startScan() {
  const raw = usernameInput.value.trim().replace(/^u\//i, "");
  if (!raw || scanning) return;

  const username = raw;
  setBusy(true);
  resetAllStages();
  logPanel.innerHTML = "";
  resultPanel.innerHTML = "";
  showPanel("log");

  log(`Starting analysis for u/${username}`, "info");

  // ── STAGE 1: run scraper ──────────────────────────────────────────────────

  setStage("scraping", "active");
  log("Launching Scrapingtool.exe…", "warn");

  const scraperOk = await runScraper(username);
  if (!scraperOk) {
    setBusy(false);
    return;
  }

  setStage("scraping", "done");
  log("Scraper finished — reading JSON…", "ok");

  // ── STAGE 2: read JSON ────────────────────────────────────────────────────

  let payload;
  try {
    payload = await electronAPI.readJson(username);
    log(`Loaded payload for ${username}`, "ok");
  } catch (err) {
    log(`Failed to read JSON: ${err.message}`, "err");
    setBusy(false);
    return;
  }

  // ── STAGE 3–6: stream from FastAPI ───────────────────────────────────────

  log("Connecting to analysis API…", "info");
  await streamFromApi(username, payload);

  setBusy(false);
}

// ── SCRAPER RUNNER ────────────────────────────────────────────────────────────

function runScraper(username) {
  return new Promise((resolve) => {
    const cleanup = electronAPI.onScraperEvent((ev) => {
      if (ev.event === "stdout") {
        log(ev.data.trim(), "info");
      } else if (ev.event === "stderr") {
        log(ev.data.trim(), "warn");
      } else if (ev.event === "done") {
        cleanup();
        resolve(true);
      } else if (ev.event === "error") {
        log(`Scraper error: ${ev.data}`, "err");
        setStage("scraping", "error");
        cleanup();
        resolve(false);
      }
    });

    electronAPI.runScraper(username);
  });
}

// ── SSE STREAM ────────────────────────────────────────────────────────────────

async function streamFromApi(username, payload) {
  const url = `${settings.apiUrl}/api/v1/process-user`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": settings.apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    log(`Network error: ${err.message}`, "err");
    return;
  }

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    log(`API returned ${response.status}: ${txt}`, "err");
    return;
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  // Map SSE step names → stage keys
  const stepStageMap = {
    ideology:  "ideology",
    aigen:     "aigen",
    frequency: "frequency",
    rhythm:    "rhythm",
    done:      "done",
    error:     "done",
  };

  // Track previous step as "done"
  let prevStep = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let event;
      try { event = JSON.parse(line.slice(6)); } catch { continue; }

      const step = event.step;

      // Mark prev step done
      if (prevStep && prevStep !== step) {
        if (prevStep !== "done" && prevStep !== "error") {
          setStage(stepStageMap[prevStep] ?? prevStep, "done");
        }
      }

      if (step === "done") {
        log("Analysis complete!", "ok");
        setStage("done", "done");
        renderResult(event.result);
        return;
      }

      if (step === "error") {
        log(`Error: ${event.message}`, "err");
        setStage("done", "error");
        return;
      }

      // Activate current stage
      setStage(stepStageMap[step] ?? step, "active");
      log(event.message, "info");
      prevStep = step;
    }
  }
}

// ── RESULT RENDERER ───────────────────────────────────────────────────────────

function renderResult(result) {
  resultPanel.innerHTML = "";
  showPanel("result");

  const prob   = result.overall_probability ?? 0;
  const isBot  = result.is_bot_overall;
  const fa     = result.full_analysis ?? {};

  // Verdict banner
  const banner = document.createElement("div");
  banner.className = `verdict ${isBot ? "bot" : "human"} fade-in`;
  banner.innerHTML = `
    <div class="verdict-icon">${isBot ? "🤖" : "👤"}</div>
    <div>
      <div class="verdict-title">u/${escHtml(result.username)} is likely a ${isBot ? "BOT" : "HUMAN"}</div>
      <div class="verdict-sub">Overall bot probability: ${pct(prob)}</div>
    </div>
    <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:120px;">
      <div style="font-size:32px;font-family:var(--sans);font-weight:800;color:${probColor(prob)}">${pct(prob)}</div>
      <div class="prob-bar-track" style="width:120px">
        <div class="prob-bar-fill" id="overall-bar" style="width:0%;background:${probColor(prob)}"></div>
      </div>
    </div>
  `;
  resultPanel.appendChild(banner);

  // Animate bar after render
  requestAnimationFrame(() => {
    setTimeout(() => {
      const bar = document.getElementById("overall-bar");
      if (bar) bar.style.width = pct(prob);
    }, 80);
  });

  // Analysis cards grid
  const grid = document.createElement("div");
  grid.className = "analysis-grid fade-in";

  const cards = [
    {
      title: "Ideology",
      data: fa.ideology,
      probKey: "bot_probability",
      extra: (d) => `
        <div class="card-desc">${escHtml(d.pattern_description ?? "")}</div>
        ${renderIndicators(d.key_indicators)}
      `,
    },
    {
      title: "AI Text",
      data: fa.ai_authenticity,
      probKey: "ai_probability",
      extra: (d) => `<div class="card-desc">${escHtml(d.reasoning ?? "")}</div>`,
    },
    {
      title: "Frequency",
      data: fa.frequency,
      probKey: "bot_probability",
      extra: () => "",
    },
    {
      title: "Rhythm",
      data: fa.rhythm,
      probKey: "bot_probability",
      extra: () => "",
    },
  ];

  cards.forEach(({ title, data, probKey, extra }, i) => {
    if (!data) return;
    const p      = data[probKey] ?? 0;
    const botish = p >= 0.5;

    const card = document.createElement("div");
    card.className = "analysis-card fade-in";
    card.style.animationDelay = `${i * 0.08}s`;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${title}</div>
        <div class="card-badge ${botish ? "bot" : "human"}">${botish ? "BOT" : "HUMAN"}</div>
      </div>
      <div class="card-prob" style="color:${probColor(p)}">${pct(p)}</div>
      <div class="prob-bar-track">
        <div class="prob-bar-fill card-bar-${i}" style="width:0%;background:${probColor(p)}"></div>
      </div>
      ${extra(data)}
    `;
    grid.appendChild(card);
  });

  resultPanel.appendChild(grid);

  // Animate card bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      cards.forEach(({ data, probKey }, i) => {
        if (!data) return;
        const bar = document.querySelector(`.card-bar-${i}`);
        if (bar) bar.style.width = pct(data[probKey] ?? 0);
      });
    }, 200);
  });
}

function renderIndicators(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return `<div class="indicators">${arr.map((s) => `<div class="indicator">${escHtml(s)}</div>`).join("")}</div>`;
}
