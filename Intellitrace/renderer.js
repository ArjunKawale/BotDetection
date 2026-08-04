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
  line.className = `log-line log-${type}`;
  line.innerHTML = `<span class="log-ts">[${ts}]</span><span>${escHtml(text)}</span>`;
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
  log("Launching Scrapingtool.exe…", "warn");

  const scraperOk = await runScraper(username);
  if (!scraperOk) {
    setBusy(false);
    return;
  }

  updateStepper("scraping", "done");
  log("Scraper finished — reading JSON…", "ok");

  // ── STAGE 2: read JSON ────────────────────────────────────────────────────

  let payload;
  try {
    payload = await electronAPI.readJson(username);
    log(`Loaded payload for ${username}`, "ok");
  } catch (err) {
    log(`Failed to read JSON: ${err.message}`, "err");
    updateStepper("scraping", "error");
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
    log(`Network error: ${err.message}`, "err");
    updateStepper("ideology", "error");
    return;
  }

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    log(`API returned ${response.status}: ${txt}`, "err");
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
        log("Analysis complete!", "ok");
        renderResult(event.result);
        setTimeout(() => showView("results"), 800); // slight delay to show 100% complete stepper
        return;
      }

      if (step === "error") {
        log(`Error: ${event.message}`, "err");
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

// ── RESULT RENDERER ───────────────────────────────────────────────────────────

function renderResult(result) {
  resultPanel.innerHTML = "";
  
  const prob = result.overall_probability ?? 0;
  const isBot = result.is_bot_overall;
  const fa = result.full_analysis ?? {};

  // Verdict banner
  const banner = document.createElement("div");
  banner.className = `verdict ${isBot ? "bot" : "human"} fade-in`;
  banner.innerHTML = `
    <div class="verdict-left">
      <div class="verdict-icon">${isBot ? "🤖" : "👤"}</div>
      <div class="verdict-info">
        <div class="verdict-username">u/${escHtml(result.username)}</div>
        <div class="verdict-label">LIKELY ${isBot ? "BOT" : "HUMAN"}</div>
        <div class="verdict-sub">AI Multimodal Analysis Complete</div>
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
      title: "Ideology",
      icon: "🧠",
      data: fa.ideology,
      probKey: "bot_probability",
      extra: (d) => `
        <div class="card-desc">${escHtml(d.pattern_description ?? "")}</div>
        ${renderIndicators(d.key_indicators)}
      `,
    },
    {
      title: "AI Text Gen",
      icon: "⚡",
      data: fa.ai_authenticity,
      probKey: "ai_probability",
      extra: (d) => `<div class="card-desc">${escHtml(d.reasoning ?? "")}</div>`,
    },
    {
      title: "Posting Frequency",
      icon: "📊",
      data: fa.frequency,
      probKey: "bot_probability",
      extra: (d) => "",
    },
    {
      title: "Behavioral Rhythm",
      icon: "⏱️",
      data: fa.rhythm,
      probKey: "bot_probability",
      extra: (d) => "",
    },
  ];

  cards.forEach(({ title, icon, data, probKey, extra }, i) => {
    if (!data) return;
    const p = data[probKey] ?? 0;
    const botish = p >= 0.5;

    const card = document.createElement("div");
    card.className = "analysis-card fade-in";
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
      ${extra(data)}
    `;
    grid.appendChild(card);
  });

  resultPanel.appendChild(grid);

  // Animations - wait until view is about to show
  setTimeout(() => {
    // Animate overall bar and text
    const overBar = document.getElementById("overall-bar");
    if (overBar) overBar.style.width = `${prob * 100}%`;
    
    const overPct = document.getElementById("overall-pct");
    if (overPct) animateCount(overPct, 0, prob * 100, 1500);

    // Animate individual card bars and text
    cards.forEach(({ data, probKey }, i) => {
      if (!data) return;
      const p = data[probKey] ?? 0;
      
      const bar = document.querySelector(`.card-bar-${i}`);
      if (bar) bar.style.width = `${p * 100}%`;
      
      // The text elements
      const allPctVals = resultPanel.querySelectorAll('.card-pct-val');
      allPctVals.forEach(el => {
         const targetVal = parseFloat(el.getAttribute('data-val')) * 100;
         animateCount(el, 0, targetVal, 1500);
      });
    });
  }, 900); // 100ms after the result panel is shown
}

function renderIndicators(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return `<div class="indicators">${arr.map(s => `<span class="indicator-tag">${escHtml(s)}</span>`).join("")}</div>`;
}

function probColor(v) {
  if (v < 0.35) return "var(--green)";
  if (v < 0.6) return "var(--amber)";
  return "var(--red)";
}