/* renderer.js — runs in the BrowserWindow (renderer process) */

// ── STATE ─────────────────────────────────────────────────────────────────────

let settings = { apiUrl: "http://localhost:8000", apiKey: "" };
let scanning = false;
let currentView = "ready"; // 'ready', 'scanning', 'results'
let currentTheme = localStorage.getItem("theme") || "dark";

// ── ELEMENTS ──────────────────────────────────────────────────────────────────

// Theme & Navigation
const themeToggle = document.getElementById("theme-toggle");
const htmlEl = document.documentElement;

// Views
const views = {
  ready: document.getElementById("view-ready"),
  scanning: document.getElementById("view-scanning"),
  results: document.getElementById("view-results")
};

// Inputs & Buttons
const usernameInput = document.getElementById("username-input");
const searchBar = document.getElementById("search-bar");
const scanBtn = document.getElementById("scan-btn");
const scanBtnText = document.getElementById("scan-btn-text");
const scanSpinner = document.getElementById("scan-spinner");
const scanAnotherBtn = document.getElementById("scan-another");
const scanBackBtn = document.getElementById("scan-back");

// Scanning View Elements
const scanningUsername = document.getElementById("scanning-username");
const terminalCard = document.getElementById("terminal-card");
const terminalToggle = document.getElementById("terminal-toggle");
const logPanel = document.getElementById("log-panel");

// Results
const resultPanel = document.getElementById("result-panel");

// Settings
const settingsOverlay = document.getElementById("settings-overlay");
const settingsToggle = document.getElementById("settings-toggle");
const settingsClose = document.getElementById("settings-close");
const settingsSave = document.getElementById("settings-save");
const settingsCancel = document.getElementById("settings-cancel");
const cfgUrl = document.getElementById("cfg-url");
const cfgKey = document.getElementById("cfg-key");

// Stepper
const steps = {
  scraping: document.querySelector('[data-step="scraping"]'),
  ideology: document.querySelector('[data-step="ideology"]'),
  aigen: document.querySelector('[data-step="aigen"]'),
  frequency: document.querySelector('[data-step="frequency"]'),
  rhythm: document.querySelector('[data-step="rhythm"]')
};

// ── INIT ──────────────────────────────────────────────────────────────────────

(async () => {
  // Load settings
  settings = await electronAPI.loadSettings();
  cfgUrl.value = settings.apiUrl;
  cfgKey.value = settings.apiKey;

  // Apply initial theme
  setTheme(currentTheme);
})();

// ── THEME MANAGEMENT ──────────────────────────────────────────────────────────

function setTheme(theme) {
  currentTheme = theme;
  htmlEl.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

themeToggle.addEventListener("click", () => {
  setTheme(currentTheme === "dark" ? "light" : "dark");
});

// ── VIEW MANAGEMENT ───────────────────────────────────────────────────────────

function showView(viewName) {
  currentView = viewName;
  Object.values(views).forEach(el => el.classList.remove("active"));
  if (views[viewName]) {
    views[viewName].classList.add("active");
  }
}

scanAnotherBtn.addEventListener("click", () => {
  if (scanning) return;
  usernameInput.value = "";
  showView("ready");
  usernameInput.focus();
});

scanBackBtn.addEventListener("click", () => {
  if (scanning) return;
  showView("ready");
});

terminalToggle.addEventListener("click", () => {
  terminalCard.classList.toggle("collapsed");
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

function updateStepper(stepName, status) {
  // status: 'active', 'done', 'error', null
  const stepEl = steps[stepName];
  if (!stepEl) return;

  stepEl.classList.remove("active", "done", "error");
  if (status) stepEl.classList.add(status);

  // Update connector line if done
  if (status === "done") {
    const nextEl = stepEl.nextElementSibling;
    if (nextEl && nextEl.classList.contains("step-connector")) {
      nextEl.classList.add("done");
    }
  } else if (!status) {
    // Reset connector
    const nextEl = stepEl.nextElementSibling;
    if (nextEl && nextEl.classList.contains("step-connector")) {
      nextEl.classList.remove("done");
    }
  }
}

function resetStepper() {
  Object.keys(steps).forEach(k => updateStepper(k, null));
}

function log(text, type = "info") {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  const line = document.createElement("div");
  
  // Semantic color mapping for terminal
  const typeClasses = {
    info: "log-info",      // Blue
    ok: "log-success",     // Green
    warn: "log-warning",   // Yellow
    err: "log-error"       // Red
  };
  
  const mappedClass = typeClasses[type] || "log-info";
  line.className = `log-line ${mappedClass}`;
  line.innerHTML = `<span class="log-ts">[${ts}]</span><span class="log-msg">${escHtml(text)}</span>`;
  logPanel.appendChild(line);
  logPanel.scrollTop = logPanel.scrollHeight;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function setBusy(busy) {
  scanning = busy;
  scanBtn.disabled = busy;
  usernameInput.disabled = busy;
  scanBackBtn.disabled = busy;

  if (busy) {
    scanBtnText.classList.add("hidden");
    scanSpinner.classList.remove("hidden");
  } else {
    scanBtnText.classList.remove("hidden");
    scanSpinner.classList.add("hidden");
  }
}

// ── ANIMATED COUNTER ──────────────────────────────────────────────────────────

function animateCount(el, start, end, duration, formatFn = val => Math.round(val)) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // easeOutQuart
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    const current = start + easeProgress * (end - start);

    el.textContent = formatFn(current);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = formatFn(end);
    }
  };
  window.requestAnimationFrame(step);
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

function openSettings() { settingsOverlay.classList.add("visible"); }
function closeSettings() { settingsOverlay.classList.remove("visible"); }

settingsToggle.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsCancel.addEventListener("click", closeSettings);

settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

settingsSave.addEventListener("click", async () => {
  settings.apiUrl = cfgUrl.value.replace(/\/$/, "");
  settings.apiKey = cfgKey.value;
  await electronAPI.saveSettings(settings);
  closeSettings();
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
  resetStepper();
  logPanel.innerHTML = "";
  resultPanel.innerHTML = "";
  scanningUsername.textContent = `u/${username}`;

  // Make sure terminal is open when starting
  terminalCard.classList.remove("collapsed");

  showView("scanning");

  log(`Starting analysis for u/${username}`, "info");

  // ── STAGE 1: run scraper ──────────────────────────────────────────────────

  updateStepper("scraping", "active");
  log("Launching Web Retrieval Engine…", "warn");

  const scraperOk = await runScraper(username);
  if (!scraperOk) {
    setBusy(false);
    return;
  }

  updateStepper("scraping", "done");
  log("Data retrieval finished — compiling semantic map…", "ok");

  // ── STAGE 2: read JSON ────────────────────────────────────────────────────

  let payload;
  try {
    payload = await electronAPI.readJson(username);
    log(`Successfully compiled payload for ${username}`, "ok");
  } catch (err) {
    log(`Failed to compile payload: ${err.message}`, "err");
    updateStepper("scraping", "error");
    setBusy(false);
    return;
  }

  // ── STAGE 3–6: stream from FastAPI ───────────────────────────────────────

  log("Establishing connection to Analysis API endpoint…", "info");
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
        log(`Retrieval error: ${ev.data}`, "err");
        updateStepper("scraping", "error");
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
    log(`Network stream error: ${err.message}`, "err");
    updateStepper("ideology", "error");
    return;
  }

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    log(`API exception ${response.status}: ${txt}`, "err");
    updateStepper("ideology", "error");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Map SSE step names → stage keys
  const stepStageMap = {
    ideology: "ideology",
    aigen: "aigen",
    frequency: "frequency",
    rhythm: "rhythm",
    done: "done",
    error: "error",
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
          updateStepper(stepStageMap[prevStep] ?? prevStep, "done");
        }
      }

      if (step === "done") {
        log("Multimodal Analysis complete!", "ok");
        // Pass the entire event result so metrics can be found anywhere
        renderResult(event.result);
        setTimeout(() => showView("results"), 800);
        return;
      }

      if (step === "error") {
        log(`Fatal Error: ${event.message}`, "err");
        if (prevStep && prevStep !== "done" && prevStep !== "error") {
          updateStepper(stepStageMap[prevStep] ?? prevStep, "error");
        }
        return;
      }

      // Activate current stage
      const stageKey = stepStageMap[step] ?? step;
      if (steps[stageKey]) {
        updateStepper(stageKey, "active");
      }
      log(event.message, "info");
      prevStep = step;
    }
  }
}

// ── EVIDENCE FIELD MAPS (Behavioral Analysis) ─────────────────────────────────
// Strict mapping: Only fields found in the processed JSON will render.

const FREQUENCY_METRICS = [
  { label: "Total Posts Analyzed", keys: ["total_posts_analyzed", "total_posts", "posts_analyzed", "post_count"] },
  { label: "Activity Density Score", keys: ["activity_density", "density", "frequency_data"] },
  { label: "Average Posting Interval", keys: ["avg_posting_interval", "average_posting_interval", "avg_interval_hours", "posting_interval_avg"], format: (v) => `${Number(v).toFixed(2)} hrs` },
  { label: "Avg Posts / Day", keys: ["avg_posts_per_day", "average_posts_per_day", "posts_per_day"] },
];

const RHYTHM_METRICS = [
  { label: "Median Gap", keys: ["median_gap_seconds", "median_gap", "median_gap_hours"], format: (v) => v > 1000 ? `${(v/3600).toFixed(1)} hrs` : `${v}` },
  { label: "Gap Variance", keys: ["gap_variance"], format: (v) => v > 1000000 ? Number(v).toExponential(2) : Number(v).toFixed(2) },
  { label: "Hour Variance", keys: ["hour_variance", "hourly_variance"], format: (v) => Number(v).toFixed(2) },
  { label: "Top-of-Hour Ratio", keys: ["top_of_hour_ratio", "top_of_hour_pct"], format: (v) => `${Math.round(v * 100)}%` },
  { label: "Sleep Gap", keys: ["avg_sleep_hours", "sleep_gap", "sleep_gap_hours"], format: (v) => `${Number(v).toFixed(1)} hrs` },
  { label: "Rhythm Consistency", keys: ["rhythm_consistency", "consistency_score"], format: (v) => `${Math.round(v * 100)}%` },
];

// ── RENDER-SIDE ASSESSMENT RULES (Behavioral Analysis) ────────────────────────
const ASSESSMENT_TEXT = {
  frequency: {
    low: "Posting cadence appears consistent with typical human activity patterns.",
    medium: "Activity density displays moderate regularity requiring contextual review.",
    high: "Posting frequency exhibits highly automated or synthetic variance characteristics.",
  },
  rhythm: {
    low: "Temporal activity rhythm aligns tightly with expected organic behavior.",
    medium: "Behavioral rhythm lacks established circadian structure, displaying moderate anomalies.",
    high: "Activity distribution and circadian variance strongly indicate synthetic scheduling.",
  },
};

function probabilityTier(p) {
  if (p < 0.35) return "low";
  if (p < 0.6) return "medium";
  return "high";
}

// Recursively search for the key across the provided result object to ensure resilience.
function getMetricValue(data, keys, fullResult) {
  for (const key of keys) {
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
    if (fullResult && fullResult[key] !== undefined && fullResult[key] !== null && fullResult[key] !== "") return fullResult[key];
    if (fullResult && fullResult.rhythm_features && fullResult.rhythm_features[key] !== undefined && fullResult.rhythm_features[key] !== null) return fullResult.rhythm_features[key];
  }
  return undefined;
}

function formatMetricValue(raw, metric) {
  if (metric.format) return metric.format(raw);
  if (typeof raw === "number") {
    if (metric.isRatio && raw <= 1) return `${Math.round(raw * 100)}%`;
    const rounded = Math.round(raw * 100) / 100;
    return metric.unit ? `${rounded} ${metric.unit}` : `${rounded}`;
  }
  return String(raw);
}

function renderEvidence(data, metricList, fullResult) {
  const rows = metricList
    .map(m => {
      const raw = getMetricValue(data, m.keys, fullResult);
      if (raw === undefined) return null;
      return { label: m.label, value: formatMetricValue(raw, m) };
    })
    .filter(Boolean);

  if (rows.length === 0) return "";

  return `
    <div class="evidence-block">
      <div class="evidence-label">Key Indicators</div>
      <div class="evidence-list">
        ${rows.map(r => `
          <div class="evidence-row">
            <span class="evidence-key">• ${escHtml(r.label)}</span>
            <span class="evidence-val">${escHtml(r.value)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderIndicators(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return `<div class="indicators">${arr.map(s => `<span class="indicator-tag">${escHtml(s)}</span>`).join("")}</div>`;
}

function renderEngineTag(label) {
  return `<div class="engine-tag">${escHtml(label)}</div>`;
}

function probColor(v) {
  if (v < 0.35) return "var(--status-human)";
  if (v < 0.6) return "var(--status-warning)";
  return "var(--status-bot)";
}

function getVerdictExplanation(prob) {
  if (prob < 0.35) return "The combined semantic and behavioral analyses indicate a very low probability of automated activity.";
  if (prob < 0.6) return "The combined semantic and behavioral analyses indicate mixed telemetry, suggesting potential hybrid operational patterns.";
  return "The combined semantic and behavioral analyses indicate a high probability of automated activity with strong synthetic markers.";
}

// ── CARD BODY BUILDERS ────────────────────────────────────────────────────────

// Semantic Engine Cards
function semanticCardBody(d, assessmentField) {
  const assessment = d[assessmentField] ?? d.pattern_description ?? d.reasoning ?? "";
  return `
    <div class="assessment-block">
      <div class="assessment-label">Analysis Summary</div>
      ${assessment ? `<div class="assessment-text">${escHtml(assessment)}</div>` : ""}
    </div>
    ${renderIndicators(d.key_indicators)}
    ${renderEngineTag("Semantic Analysis Engine")}
  `;
}

// Behavioral Engine Cards
function behavioralCardBody(d, prob, kind, metricList, fullResult) {
  const tier = probabilityTier(prob);
  const assessment = ASSESSMENT_TEXT[kind][tier];
  return `
    <div class="assessment-block">
      <div class="assessment-label">Assessment</div>
      <div class="assessment-text">${escHtml(assessment)}</div>
    </div>
    ${renderEvidence(d, metricList, fullResult)}
    ${renderEngineTag("Behavioral Analysis Engine")}
  `;
}

// ── RESULT RENDERER ───────────────────────────────────────────────────────────

function renderResult(result) {
  resultPanel.innerHTML = "";

  const prob = result.overall_probability ?? 0;
  const isBot = result.is_bot_overall;
  const fa = result.full_analysis ?? {};
  const verdictExplanation = getVerdictExplanation(prob);

  // Verdict banner
  const banner = document.createElement("div");
  banner.className = `verdict ${isBot ? "bot" : "human"} fade-in`;
  banner.innerHTML = `
    <div class="verdict-left">
      <div class="verdict-icon">${isBot ? "🤖" : "👤"}</div>
      <div class="verdict-info">
        <div class="verdict-username">u/${escHtml(result.username)}</div>
        <div class="verdict-label">LIKELY ${isBot ? "BOT" : "HUMAN"}</div>
        <div class="verdict-sub">Overall Verdict</div>
        <div class="verdict-desc">${escHtml(verdictExplanation)}</div>
      </div>
    </div>
    <div class="verdict-right">
      <div class="verdict-pct" style="color: ${probColor(prob)}"><span id="overall-pct">0</span>%</div>
      <div class="prob-bar-track">
        <div class="prob-bar-fill" id="overall-bar" style="width:0%; background: ${probColor(prob)}"></div>
      </div>
    </div>
  `;
  resultPanel.appendChild(banner);

  // Analysis cards grid
  const grid = document.createElement("div");
  grid.className = "analysis-grid";

  const cards = [
    {
      title: "Semantic Coherence",
      icon: "🧠",
      data: fa.ideology || result.ideology,
      probKey: "bot_probability",
      type: "semantic",
      extra: (d) => semanticCardBody(d, "pattern_description"),
    },
    {
      title: "Text Authenticity",
      icon: "⚡",
      data: fa.ai_authenticity || result.ai_authenticity,
      probKey: "ai_probability",
      type: "semantic",
      extra: (d) => semanticCardBody(d, "reasoning"),
    },
    {
      title: "Posting Cadence",
      icon: "📊",
      data: fa.frequency || result.frequency,
      probKey: "bot_probability",
      type: "behavioral",
      extra: (d, p, fullRes) => behavioralCardBody(d, p, "frequency", FREQUENCY_METRICS, fullRes),
    },
    {
      title: "Behavioral Rhythm",
      icon: "⏱️",
      data: fa.rhythm || result.rhythm,
      probKey: "bot_probability",
      type: "behavioral",
      extra: (d, p, fullRes) => behavioralCardBody(d, p, "rhythm", RHYTHM_METRICS, fullRes),
    },
  ];

  cards.forEach(({ title, icon, data, probKey, type, extra }, i) => {
    // Graceful fallback structure for dynamic payloads
    const cardData = data || {}; 
    const p = cardData[probKey] ?? (i > 1 ? result.frequency_data ?? 0 : 0);
    const botish = p >= 0.5;

    const card = document.createElement("div");
    card.className = `analysis-card card-${type} fade-in`;
    card.style.animationDelay = `${0.1 + i * 0.08}s`;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-row">
          <span class="card-icon">${icon}</span>
          <span class="card-title">${title}</span>
        </div>
        <div class="card-badge ${botish ? "bot" : "human"}">${botish ? "BOT" : "HUMAN"}</div>
      </div>
      <div class="card-prob" style="color: ${probColor(p)}"><span class="card-pct-val" data-val="${p}">0</span>%</div>
      <div class="prob-bar-track">
        <div class="prob-bar-fill card-bar-${i}" style="width:0%; background: ${probColor(p)}"></div>
      </div>
      ${extra(cardData, p, result)}
    `;
    grid.appendChild(card);
  });

  resultPanel.appendChild(grid);

  // Animations - Execute smoothly when DOM is painted
  setTimeout(() => {
    const overBar = document.getElementById("overall-bar");
    if (overBar) overBar.style.width = `${prob * 100}%`;

    const overPct = document.getElementById("overall-pct");
    if (overPct) animateCount(overPct, 0, prob * 100, 1200);

    const allPctVals = resultPanel.querySelectorAll('.card-pct-val');
    allPctVals.forEach((el, index) => {
      const targetVal = parseFloat(el.getAttribute('data-val')) * 100;
      animateCount(el, 0, targetVal, 1000 + (index * 150));
      
      const bar = document.querySelector(`.card-bar-${index}`);
      if (bar) bar.style.width = `${targetVal}%`;
    });
  }, 900);
}