/* ==========================================================================
   IntelliTrace Renderer — Production Application Logic
   Architecture: Modular, robust, event-driven, defensive.
   ========================================================================== */

// ── 1. Constants ──────────────────────────────────────────────────────────────
const CONSTANTS = {
  UI_ANIMATION_DELAY: 150,
  MAX_TERMINAL_LINES: 500,
  REGEX_USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  HTTP_TIMEOUT_MS: 30000,
  SYSTEM_VERSION: "2.4.0"
};

// ── 2. Application State ──────────────────────────────────────────────────────
const AppState = {
  settings: { apiUrl: "http://localhost:8000", apiKey: "" },
  isScanning: false,
  currentUsername: null,
  theme: "dark",
  scrapedData: null,
  apiResult: null
};

// ── 3. DOM Cache ──────────────────────────────────────────────────────────────
const DOM = {
  htmlEl: document.documentElement,
  themeToggle: document.getElementById("theme-toggle"),
  
  views: {
    ready: document.getElementById("view-ready"),
    scanning: document.getElementById("view-scanning"),
    results: document.getElementById("view-results")
  },
  
  inputs: {
    searchBar: document.getElementById("search-bar"),
    username: document.getElementById("username-input"),
    scanBtn: document.getElementById("scan-btn"),
    scanBtnText: document.getElementById("scan-btn-text"),
    scanSpinner: document.getElementById("scan-spinner"),
    scanAnotherBtn: document.getElementById("scan-another"),
    scanBackBtn: document.getElementById("scan-back")
  },
  
  settings: {
    overlay: document.getElementById("settings-overlay"),
    toggle: document.getElementById("settings-toggle"),
    close: document.getElementById("settings-close"),
    save: document.getElementById("settings-save"),
    cancel: document.getElementById("settings-cancel"),
    url: document.getElementById("cfg-url"),
    key: document.getElementById("cfg-key")
  },
  
  scanning: {
    username: document.getElementById("scanning-username"),
    terminalCard: document.getElementById("terminal-card"),
    terminalToggle: document.getElementById("terminal-toggle"),
    logPanel: document.getElementById("log-panel"),
    steps: {
      scraping: document.querySelector('[data-step="scraping"]'),
      ideology: document.querySelector('[data-step="ideology"]'),
      aigen: document.querySelector('[data-step="aigen"]'),
      frequency: document.querySelector('[data-step="frequency"]'),
      rhythm: document.querySelector('[data-step="rhythm"]')
    }
  },
  
  results: {
    panel: document.getElementById("result-panel"),
    recentPosts: document.getElementById("recentPosts"),
    recentComments: document.getElementById("recentComments"),
    timeline: document.getElementById("timelineContainer"),
    exportPdf: document.getElementById("download-report-btn"),
    exportJson: document.getElementById("export-json-btn")
  }
};

// ── 4. Initialization ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initializeApp();
  } catch (err) {
    console.error("Critical Initialization Failure:", err);
  }
});

async function initializeApp() {
  // Load User Preferences
  try {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) AppState.theme = savedTheme;
    ThemeManager.applyTheme(AppState.theme);

    const savedSettings = await electronAPI.loadSettings();
    if (savedSettings) {
      AppState.settings = savedSettings;
      DOM.settings.url.value = AppState.settings.apiUrl || "";
      DOM.settings.key.value = AppState.settings.apiKey || "";
    }
  } catch (error) {
    Terminal.log(`Warning: Failed to load local preferences (${error.message})`, "warn");
  }

  bindEvents();
}

function bindEvents() {
  // Navigation & Toggles
  DOM.themeToggle?.addEventListener("click", ThemeManager.toggle);
  DOM.scanning.terminalToggle?.addEventListener("click", () => {
    DOM.scanning.terminalCard.classList.toggle("collapsed");
  });

  // Settings Modal
  DOM.settings.toggle?.addEventListener("click", SettingsManager.open);
  DOM.settings.close?.addEventListener("click", SettingsManager.close);
  DOM.settings.cancel?.addEventListener("click", SettingsManager.close);
  DOM.settings.save?.addEventListener("click", SettingsManager.save);
  DOM.settings.overlay?.addEventListener("click", (e) => {
    if (e.target === DOM.settings.overlay) SettingsManager.close();
  });

  // Scan Execution
  DOM.inputs.scanBtn?.addEventListener("click", handleScanTrigger);
  DOM.inputs.username?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleScanTrigger();
  });

  // Reset & Returns
  DOM.inputs.scanAnotherBtn?.addEventListener("click", handleReset);
  DOM.inputs.scanBackBtn?.addEventListener("click", handleReset);

  // Clear validation styling on input
  DOM.inputs.username?.addEventListener("input", () => {
    if (DOM.inputs.searchBar) DOM.inputs.searchBar.style.borderColor = "";
  });

  // Export
  DOM.results.exportPdf?.addEventListener("click", ExportManager.downloadPDF);
  DOM.results.exportJson?.addEventListener("click", ExportManager.exportJSON);
}

// ── 5. Shared Utilities ───────────────────────────────────────────────────────
const Utils = {
  escHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
  
  getProbColor(prob) {
    if (prob < 0.35) return "var(--accent-green)";
    if (prob < 0.60) return "var(--accent-orange)";
    return "var(--accent-red)";
  },

  formatTimeAgo(unixSeconds) {
    if (!unixSeconds) return "Unknown";
    const diff = Math.floor(Date.now() / 1000 - unixSeconds);
    if (diff < 60) return `${diff} secs ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  },

  animateCounter(element, start, end, durationMs) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4); // Quartic ease out
      const current = start + easeOut * (end - start);
      
      element.textContent = Math.round(current);
      if (progress < 1) window.requestAnimationFrame(step);
      else element.textContent = end;
    };
    window.requestAnimationFrame(step);
  }
};

const FormatUtils = {
  truncatePost(text) {
    if (!text) return "";
    let clean = String(text).replace(/\s+/g, " ").trim();
    if (clean.length <= 90) return clean;
    return clean.substring(0, 87).trim() + "…";
  },
  
  truncateComment(text) {
    if (!text) return "";
    let clean = String(text).replace(/\s+/g, " ").trim();
    if (clean.length <= 130) return clean;
    const start = clean.substring(0, 80).trim();
    const end = clean.substring(clean.length - 45).trim();
    return `${start}... ...${end}`;
  },
  
  truncateReasoning(text) {
    if (!text) return "";
    const clean = String(text).trim();
    const sentences = clean.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length <= 3) return clean;
    return sentences.slice(0, 3).join("").trim();
  },

  truncateDescription(text) {
    if (!text) return "";
    let clean = String(text).replace(/\s+/g, " ").trim();
    if (clean.length <= 150) return clean;
    return clean.substring(0, 147).trim() + "…";
  },
  
  calculateConfidence(probRaw, explicitConfidence) {
    if (explicitConfidence !== undefined && explicitConfidence !== null) return Math.round(explicitConfidence * 100);
    if (probRaw === undefined || probRaw === null) return 0;
    return Math.round((Math.abs(probRaw - 0.5) * 2) * 100);
  },
  
  formatGapVariance(num) {
    if (num === undefined || num === null) return null;
    if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toLocaleString();
  },
  
  formatNumber(num, suffix = "") {
    if (num === undefined || num === null) return null;
    return num.toLocaleString() + (suffix ? ` ${suffix}` : "");
  },
  
  formatHours(num) {
    if (num === undefined || num === null) return null;
    return num.toFixed(1) + " hrs";
  },

  formatDays(num) {
    if (num === undefined || num === null) return null;
    return num.toFixed(2);
  },
  
  formatTimestamp(unixSeconds) {
    if (!unixSeconds) return null;
    const d = new Date(unixSeconds * 1000);
    const date = d.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString("en-GB", { hour: '2-digit', minute:'2-digit' });
    return { date, time };
  },

  generateFrequencyExplanation(probRaw) {
    return probRaw >= 0.5
      ? "Posting activity is unusually frequent and may indicate automated behaviour."
      : "Posting frequency falls within the expected range for a typical human Reddit account.";
  },

  generateRhythmExplanation(probRaw) {
    return probRaw >= 0.5
      ? "Highly periodic posting intervals suggest automated scheduling behaviour."
      : "Posting intervals vary naturally and resemble organic human behaviour.";
  },

  extractTopIndicators(indicators) {
    return (indicators || []).slice(0, 3);
  }
};

// ── 6. Theme Management ───────────────────────────────────────────────────────
const ThemeManager = {
  applyTheme(theme) {
    AppState.theme = theme;
    DOM.htmlEl.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  },
  toggle() {
    ThemeManager.applyTheme(AppState.theme === "dark" ? "light" : "dark");
  }
};

// ── 7. Settings Management ────────────────────────────────────────────────────
const SettingsManager = {
  open() { 
    DOM.settings.overlay?.classList.add("visible"); 
  },
  close() { 
    DOM.settings.overlay?.classList.remove("visible"); 
  },
  async save() {
    const newUrl = DOM.settings.url.value.trim().replace(/\/$/, "");
    const newKey = DOM.settings.key.value.trim();
    
    if (!newUrl.startsWith("http")) {
      Terminal.log("Validation Error: API URL must start with http:// or https://", "warn");
      return;
    }

    AppState.settings.apiUrl = newUrl;
    AppState.settings.apiKey = newKey;

    try {
      await electronAPI.saveSettings(AppState.settings);
      Terminal.log("System configuration updated successfully.", "ok");
      SettingsManager.close();
    } catch (error) {
      Terminal.log(`Failed to persist settings: ${error.message}`, "err");
    }
  }
};

// ── 8. View Management ────────────────────────────────────────────────────────
const ViewManager = {
  show(viewId) {
    Object.values(DOM.views).forEach(el => {
      if (el) el.classList.remove("active");
    });
    if (DOM.views[viewId]) {
      DOM.views[viewId].classList.add("active");
    }
  },
  
  setBusyState(isBusy) {
    AppState.isScanning = isBusy;
    if (DOM.inputs.scanBtn) DOM.inputs.scanBtn.disabled = isBusy;
    if (DOM.inputs.username) DOM.inputs.username.disabled = isBusy;
    if (DOM.inputs.scanBackBtn) DOM.inputs.scanBackBtn.disabled = isBusy;

    if (isBusy) {
      DOM.inputs.scanBtnText?.classList.add("hidden");
      DOM.inputs.scanSpinner?.classList.remove("hidden");
    } else {
      DOM.inputs.scanBtnText?.classList.remove("hidden");
      DOM.inputs.scanSpinner?.classList.add("hidden");
    }
  }
};

function handleReset() {
  if (AppState.isScanning) return;
  DOM.inputs.username.value = "";
  DOM.inputs.searchBar.style.borderColor = "";
  ViewManager.show("ready");
  setTimeout(() => DOM.inputs.username.focus(), 100);
}

// ── 9. Validation & Execution Trigger ─────────────────────────────────────────
function handleScanTrigger() {
  if (AppState.isScanning) return;

  const rawInput = DOM.inputs.username.value.trim().replace(/^u\//i, "");
  
  if (!rawInput) {
    showInputError("Target Reddit username is required.");
    return;
  }
  
  if (!CONSTANTS.REGEX_USERNAME.test(rawInput)) {
    showInputError("Invalid formatting. Must be 3-20 alphanumeric characters.");
    return;
  }
  
  DOM.inputs.searchBar.style.borderColor = "";
  AppState.currentUsername = rawInput;
  executeWorkflow(rawInput);
}

function showInputError(msg) {
  if (DOM.inputs.searchBar) DOM.inputs.searchBar.style.borderColor = "var(--accent-red)";
  Terminal.log(`Pre-flight Validation Failed: ${msg}`, "warn");
}

// ── 10. Pipeline Tracker ──────────────────────────────────────────────────────
const Pipeline = {
  reset() {
    Object.values(DOM.scanning.steps).forEach(stepEl => {
      if (!stepEl) return;
      stepEl.classList.remove("active", "done", "error");
      
      const connector = stepEl.nextElementSibling;
      if (connector && connector.classList.contains("step-connector")) {
        connector.classList.remove("done");
      }
    });
  },
  
  update(stepKey, status) {
    const stepEl = DOM.scanning.steps[stepKey];
    if (!stepEl) return;

    stepEl.classList.remove("active", "done", "error");
    if (status) stepEl.classList.add(status);

    const connector = stepEl.nextElementSibling;
    if (connector && connector.classList.contains("step-connector")) {
      if (status === "done") connector.classList.add("done");
      else connector.classList.remove("done");
    }
  }
};

// ── 11. Terminal System ───────────────────────────────────────────────────────
const Terminal = {
  clear() {
    if (DOM.scanning.logPanel) DOM.scanning.logPanel.innerHTML = "";
  },
  
  log(message, type = "info") {
    if (!DOM.scanning.logPanel) return;

    const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const line = document.createElement("div");
    line.className = `log-line log-${type}`;
    
    line.innerHTML = `<span class="log-ts">[${ts}]</span> <span class="log-msg">${Utils.escHtml(message)}</span>`;
    DOM.scanning.logPanel.appendChild(line);
    
    // Auto-prune to prevent memory leaks
    if (DOM.scanning.logPanel.childNodes.length > CONSTANTS.MAX_TERMINAL_LINES) {
      DOM.scanning.logPanel.removeChild(DOM.scanning.logPanel.firstChild);
    }
    
    // Auto-scroll
    DOM.scanning.logPanel.scrollTop = DOM.scanning.logPanel.scrollHeight;
  }
};

// ── 12. Main Analysis Workflow ────────────────────────────────────────────────
async function executeWorkflow(username) {
  ViewManager.setBusyState(true);
  Pipeline.reset();
  Terminal.clear();
  
  if (DOM.results.panel) DOM.results.panel.innerHTML = "";
  if (DOM.scanning.username) DOM.scanning.username.textContent = `u/${username}`;
  DOM.scanning.terminalCard?.classList.remove("collapsed");
  
  ViewManager.show("scanning");
  Terminal.log(`Initializing forensic telemetry for u/${username}...`, "info");

  // Phase 1: Subprocess Scraping via IPC
  Pipeline.update("scraping", "active");
  const scrapeSuccess = await handleScrapingSubprocess(username);
  
  if (!scrapeSuccess) {
    ViewManager.setBusyState(false);
    return; // Terminal already logged the error
  }
  Pipeline.update("scraping", "done");

  // Phase 2: Feature Extraction (Local JSON Retrieval)
  Terminal.log("Extracting local features from user payload...", "info");
  try {
    AppState.scrapedData = await electronAPI.readJson(username);
    Terminal.log("Extraction verified. JSON parsed successfully.", "ok");
  } catch (error) {
    Terminal.log(`Feature Extraction Error: ${error.message}`, "err");
    Pipeline.update("scraping", "error"); 
    ViewManager.setBusyState(false);
    return;
  }

  // Phase 3: Remote ML Pipeline (SSE Streaming)
  Terminal.log(`Establishing secure connection to Analysis API (${AppState.settings.apiUrl})...`, "info");
  await streamAnalysisAPI(username, AppState.scrapedData);
  
  ViewManager.setBusyState(false);
}

// ── 13. IPC Interfacing ───────────────────────────────────────────────────────
function handleScrapingSubprocess(username) {
  return new Promise((resolve) => {
    const removeListener = electronAPI.onScraperEvent((ev) => {
      switch (ev.event) {
        case "stdout":
          Terminal.log(`[Scraper] ${ev.data.trim()}`, "info");
          break;
        case "stderr":
          Terminal.log(`[Scraper Warn] ${ev.data.trim()}`, "warn");
          break;
        case "error":
          Terminal.log(`[Process Error] ${ev.data}`, "err");
          Pipeline.update("scraping", "error");
          removeListener();
          resolve(false);
          break;
        case "done":
          if (ev.data === 0) {
            Terminal.log(`Subprocess executed successfully (Exit 0).`, "ok");
            removeListener();
            resolve(true);
          } else {
            Terminal.log(`Subprocess failed (Exit Code: ${ev.data}).`, "err");
            Pipeline.update("scraping", "error");
            removeListener();
            resolve(false);
          }
          break;
      }
    });

    electronAPI.runScraper(username);
  });
}

async function streamAnalysisAPI(username, payload) {
  const endpoint = `${AppState.settings.apiUrl}/api/v1/process-user`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.HTTP_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": AppState.settings.apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown HTTP exception.");
      throw new Error(`HTTP ${response.status} - ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    
    // Map backend SSE step IDs to frontend Pipeline DOM keys
    const stageMap = {
      ideology: "ideology",
      aigen: "aigen",
      frequency: "frequency",
      rhythm: "rhythm",
      ensemble: "done"
    };

    let previousStep = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n");
      buffer = chunks.pop(); // Keep incomplete chunk in buffer

      for (const line of chunks) {
        if (!line.startsWith("data: ")) continue;
        
        let eventPayload;
        try {
          eventPayload = JSON.parse(line.slice(6).trim());
        } catch {
          continue; // Malformed JSON chunk, skip gracefully
        }

        const currentStep = eventPayload.step;

        // Automatically complete the previous step visually
        if (previousStep && previousStep !== currentStep && previousStep !== "error") {
          const mappedPrev = stageMap[previousStep] || previousStep;
          Pipeline.update(mappedPrev, "done");
        }

        if (currentStep === "error") {
          Terminal.log(`Pipeline Aborted: ${eventPayload.message || "Unknown API error"}`, "err");
          const mappedFail = stageMap[previousStep] || "ideology"; 
          Pipeline.update(mappedFail, "error");
          return;
        }

        if (currentStep === "done" || currentStep === "ensemble") {
          Terminal.log("Ensemble consensus reached. Analysis complete.", "ok");
          AppState.apiResult = eventPayload.result || {};
          renderDashboard(AppState.apiResult, AppState.scrapedData);
          setTimeout(() => ViewManager.show("results"), 400); // Visual buffer
          return;
        }

        // Advance visual stepper
        const mappedCurrent = stageMap[currentStep] || currentStep;
        Pipeline.update(mappedCurrent, "active");
        Terminal.log(eventPayload.message || `Processing module: ${currentStep}...`, "info");
        
        previousStep = currentStep;
      }
    }
  } catch (error) {
    Terminal.log(`Network/Stream Failure: ${error.message}`, "err");
    Pipeline.update("ideology", "error"); // Fallback fail state
  }
}

// ── 14. Dashboard Rendering ───────────────────────────────────────────────────
function renderDashboard(apiData, scrapedData) {
  if (!DOM.results.panel) return;
  DOM.results.panel.innerHTML = "";

  // 1. Verdict Banner
  DOM.results.panel.appendChild(createVerdictBanner(apiData));

  // 2. Grid Container & Cards
  const gridContainer = document.createElement("div");
  gridContainer.className = "analysis-grid";
  
  gridContainer.appendChild(createSemanticCard(apiData));
  gridContainer.appendChild(createAITextCard(apiData));
  gridContainer.appendChild(createFrequencyCard(apiData, scrapedData));
  gridContainer.appendChild(createRhythmCard(apiData, scrapedData));
  
  DOM.results.panel.appendChild(gridContainer);

  // 3. Activity Timeline
  renderActivityData(scrapedData);

  // 4. Trigger DOM Animations slightly after injection
  setTimeout(() => {
    document.querySelectorAll('.animate-bar').forEach(bar => {
      bar.style.width = bar.getAttribute('data-width') + '%';
    });
    document.querySelectorAll('.animate-pct').forEach(pct => {
      const target = parseInt(pct.getAttribute('data-val'), 10) || 0;
      Utils.animateCounter(pct, 0, target, 1200);
    });
  }, 50);
}

function createVerdictBanner(data) {
  const probRaw = data?.overall_probability ?? 0;
  const probPct = Math.round(probRaw * 100);
  const isBot = probRaw >= 0.5;
  const themeClass = isBot ? "bot" : "human";
  const labelText = isBot ? "LIKELY BOT" : "LIKELY HUMAN";
  const iconText = isBot ? "🤖" : "👤";
  
  const riskLevel = probRaw > 0.75 ? "HIGH" : (probRaw > 0.4 ? "MEDIUM" : "LOW");
  const reportId = `ITR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`;
  const timestamp = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const banner = document.createElement("div");
  banner.className = `verdict ${themeClass} fade-in`;
  
  banner.innerHTML = `
    <div class="verdict-left">
      <div class="verdict-icon">${iconText}</div>
      <div class="verdict-info">
        <div class="verdict-username">u/${Utils.escHtml(AppState.currentUsername)}</div>
        <div class="verdict-label">${labelText}</div>
        <div class="verdict-sub">Overall Consensus Verdict</div>
        
        <div class="verdict-desc" style="display: flex; gap: var(--space-24); margin-top: var(--space-8);">
          <div><strong>Risk Level:</strong> <span style="color: var(${isBot ? '--accent-red' : '--accent-green'})">${riskLevel}</span></div>
          <div><strong>Time:</strong> ${timestamp}</div>
          <div><strong>Report ID:</strong> ${reportId}</div>
        </div>
      </div>
    </div>
    
    <div class="verdict-right">
      <div class="verdict-sub">OVERALL PROBABILITY</div>
      <div class="verdict-pct" style="color: ${Utils.getProbColor(probRaw)}">
        <span class="animate-pct" data-val="${probPct}">0</span>%
      </div>
      <div class="prob-bar-track">
        <div class="prob-bar-fill animate-bar" style="width: 0%; background: ${Utils.getProbColor(probRaw)};" data-width="${probPct}"></div>
      </div>
    </div>
  `;
  return banner;
}

function createSemanticCard(data) {
  const src = data?.full_analysis?.ideology || data?.ideology || {};
  const prob = src.bot_probability ?? 0;
  const isBot = prob >= 0.5;
  const probPct = Math.round(prob * 100);
  const confPct = FormatUtils.calculateConfidence(prob, src.confidence);

  const classification = src.content_classification;
  const botType = src.bot_type;
  const patternDetected = src.pattern_detected || src.pattern_type;
  const patternDesc = FormatUtils.truncateDescription(src.pattern_description);
  const indicators = FormatUtils.extractTopIndicators(src.key_indicators);

  const card = document.createElement("div");
  card.className = "analysis-card fade-in";
  card.style.animationDelay = "0.1s";
  
  let evidenceHTML = '';
  if (classification || patternDetected || botType) {
    evidenceHTML += `<div class="evidence-block">`;
    if (classification) {
      evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Classification</span><span class="evidence-val">${Utils.escHtml(classification)}</span></div>`;
    }
    if (patternDetected) {
      evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Pattern Detected</span><span class="evidence-val">${Utils.escHtml(patternDetected)}</span></div>`;
    }
    if (botType) {
      evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Bot Type</span><span class="evidence-val">${Utils.escHtml(botType)}</span></div>`;
    }
    evidenceHTML += `</div>`;
  }

  let assessmentHTML = '';
  if (patternDesc) {
    assessmentHTML += `
    <div class="assessment-block">
      <div class="assessment-label">Pattern Description</div>
      <div class="assessment-text">${Utils.escHtml(patternDesc)}</div>
    </div>`;
  }

  let indicatorsHTML = '';
  if (indicators.length > 0) {
    indicatorsHTML = `
    <div class="assessment-block">
      <div class="assessment-label">Key Indicators</div>
      <ul style="margin-left: var(--space-16); list-style: disc;">
        ${indicators.map(ind => `<li class="assessment-text">${Utils.escHtml(ind)}</li>`).join("")}
      </ul>
    </div>`;
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-row">
        <span class="card-icon">🧠</span>
        <span class="card-title">1. Semantic Analysis</span>
      </div>
      <div class="card-badge ${isBot ? 'bot' : 'human'}">${isBot ? 'Likely Bot' : 'Likely Human'}</div>
    </div>
    <div class="card-prob" style="color: ${Utils.getProbColor(prob)}; display: flex; align-items: baseline; gap: var(--space-8);">
      <div><span class="animate-pct" data-val="${probPct}">0</span>%</div>
      <div style="font-size: var(--text-meta); color: var(--text-secondary); font-weight: 500; font-family: var(--font-sans);">Conf: ${confPct}%</div>
    </div>
    <div class="prob-bar-track">
      <div class="prob-bar-fill animate-bar" style="width: 0%; background: ${Utils.getProbColor(prob)};" data-width="${probPct}"></div>
    </div>
    ${evidenceHTML}
    ${assessmentHTML}
    ${indicatorsHTML}
  `;
  return card;
}

function createAITextCard(data) {
  const src = data?.full_analysis?.ai_authenticity || data?.ai_authenticity || {};
  const prob = src.ai_probability ?? 0;
  const isBot = prob >= 0.5;
  const probPct = Math.round(prob * 100);
  const confPct = FormatUtils.calculateConfidence(prob, src.confidence);

  const verdict = src.verdict;
  const reasoning = FormatUtils.truncateReasoning(src.reasoning);

  const card = document.createElement("div");
  card.className = "analysis-card fade-in";
  card.style.animationDelay = "0.2s";
  
  let assessmentHTML = '';
  if (verdict) {
    assessmentHTML += `
    <div class="assessment-block">
      <div class="assessment-label">Engine Verdict</div>
      <div class="assessment-text">${Utils.escHtml(verdict)}</div>
    </div>`;
  }
  if (reasoning) {
    assessmentHTML += `
    <div class="assessment-block">
      <div class="assessment-label">Heuristic Reasoning</div>
      <div class="assessment-text">${Utils.escHtml(reasoning)}</div>
    </div>`;
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-row">
        <span class="card-icon">⚡</span>
        <span class="card-title">2. AI Text Authenticity</span>
      </div>
      <div class="card-badge ${isBot ? 'bot' : 'human'}">${isBot ? 'Likely AI' : 'Human Text'}</div>
    </div>
    <div class="card-prob" style="color: ${Utils.getProbColor(prob)}; display: flex; align-items: baseline; gap: var(--space-8);">
      <div><span class="animate-pct" data-val="${probPct}">0</span>%</div>
      <div style="font-size: var(--text-meta); color: var(--text-secondary); font-weight: 500; font-family: var(--font-sans);">Conf: ${confPct}%</div>
    </div>
    <div class="prob-bar-track">
      <div class="prob-bar-fill animate-bar" style="width: 0%; background: ${Utils.getProbColor(prob)};" data-width="${probPct}"></div>
    </div>
    ${assessmentHTML}
  `;
  return card;
}

function createFrequencyCard(apiData, scrapedData) {
  const srcAPI = apiData?.full_analysis?.frequency || apiData?.frequency || {};
  const prob = srcAPI.bot_probability ?? apiData?.frequency_data ?? 0;
  const isBot = prob >= 0.5;
  const probPct = Math.round(prob * 100);
  const confPct = FormatUtils.calculateConfidence(prob, srcAPI.confidence);
  
  const rf = scrapedData?.rhythm_features_7_day_basis || scrapedData?.rhythm_features || {};
  const localFreq = rf.posting_frequency_days ?? scrapedData?.frequency_data;
  const formattedFreq = FormatUtils.formatDays(localFreq);
  const localPosts = rf.total_posts;
  
  const explanationDesc = FormatUtils.generateFrequencyExplanation(prob);

  const card = document.createElement("div");
  card.className = "analysis-card fade-in";
  card.style.animationDelay = "0.3s";
  
  let evidenceHTML = '';
  if (formattedFreq !== null || localPosts !== undefined) {
     evidenceHTML += `<div class="evidence-block">`;
     if (formattedFreq !== null) {
         evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Frequency (Days)</span><span class="evidence-val">${formattedFreq}</span></div>`;
     }
     if (localPosts !== undefined && localPosts !== null) {
         evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Posts Analysed</span><span class="evidence-val">${localPosts}</span></div>`;
     }
     evidenceHTML += `</div>`;
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-row">
        <span class="card-icon">📊</span>
        <span class="card-title">3. Posting Frequency</span>
      </div>
      <div class="card-badge ${isBot ? 'bot' : 'human'}">${isBot ? 'Anomalous' : 'Organic'}</div>
    </div>
    <div class="card-prob" style="color: ${Utils.getProbColor(prob)}; display: flex; align-items: baseline; gap: var(--space-8);">
      <div><span class="animate-pct" data-val="${probPct}">0</span>%</div>
      <div style="font-size: var(--text-meta); color: var(--text-secondary); font-weight: 500; font-family: var(--font-sans);">Conf: ${confPct}%</div>
    </div>
    <div class="prob-bar-track">
      <div class="prob-bar-fill animate-bar" style="width: 0%; background: ${Utils.getProbColor(prob)};" data-width="${probPct}"></div>
    </div>
    ${evidenceHTML}
    <div class="assessment-block">
       <div class="assessment-label">Activity Pattern</div>
       <div class="assessment-text">${explanationDesc}</div>
    </div>
  `;
  return card;
}

function createRhythmCard(apiData, scrapedData) {
  const srcAPI = apiData?.full_analysis?.rhythm || apiData?.rhythm || {};
  const prob = srcAPI.bot_probability ?? 0;
  const isBot = prob >= 0.5;
  const probPct = Math.round(prob * 100);
  const confPct = FormatUtils.calculateConfidence(prob, srcAPI.confidence);
  
  const rf = scrapedData?.rhythm_features_7_day_basis || scrapedData?.rhythm_features || {};
  const medGap = FormatUtils.formatNumber(rf.median_gap_seconds, "sec");
  const gapVar = FormatUtils.formatGapVariance(rf.gap_variance);
  const topRatio = rf.top_of_hour_ratio !== undefined && rf.top_of_hour_ratio !== null ? (rf.top_of_hour_ratio * 100).toFixed(1) + "%" : null;
  const sleepHr = FormatUtils.formatHours(rf.avg_sleep_hours);

  const cadenceDesc = FormatUtils.generateRhythmExplanation(prob);

  const card = document.createElement("div");
  card.className = "analysis-card fade-in";
  card.style.animationDelay = "0.4s";
  
  let evidenceHTML = '';
  if (medGap || gapVar || topRatio || sleepHr) {
     evidenceHTML += `<div class="evidence-block">`;
     if (medGap) evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Median Gap</span><span class="evidence-val">${medGap}</span></div>`;
     if (gapVar) evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Gap Variance</span><span class="evidence-val">${gapVar}</span></div>`;
     if (topRatio) evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Top of Hour Hit</span><span class="evidence-val">${topRatio}</span></div>`;
     if (sleepHr) evidenceHTML += `<div class="evidence-row"><span class="evidence-key">Avg Sleep Cycle</span><span class="evidence-val">${sleepHr}</span></div>`;
     evidenceHTML += `</div>`;
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-row">
        <span class="card-icon">⏱️</span>
        <span class="card-title">4. Rhythm Analysis</span>
      </div>
      <div class="card-badge ${isBot ? 'bot' : 'human'}">${isBot ? 'Automated' : 'Biological'}</div>
    </div>
    <div class="card-prob" style="color: ${Utils.getProbColor(prob)}; display: flex; align-items: baseline; gap: var(--space-8);">
      <div><span class="animate-pct" data-val="${probPct}">0</span>%</div>
      <div style="font-size: var(--text-meta); color: var(--text-secondary); font-weight: 500; font-family: var(--font-sans);">Conf: ${confPct}%</div>
    </div>
    <div class="prob-bar-track">
      <div class="prob-bar-fill animate-bar" style="width: 0%; background: ${Utils.getProbColor(prob)};" data-width="${probPct}"></div>
    </div>
    ${evidenceHTML}
    <div class="assessment-block">
      <div class="assessment-label">Cadence Profile</div>
      <div class="assessment-text">${cadenceDesc}</div>
    </div>
  `;
  return card;
}

// ── 15. Activity Data Rendering ───────────────────────────────────────────────
function renderActivityData(scrapedData) {
  const cPosts = DOM.results.recentPosts;
  const cComments = DOM.results.recentComments;
  const cTimeline = DOM.results.timeline;
  
  if (!cPosts || !cComments || !cTimeline) return;
  
  const activityPanel = DOM.results.panel.querySelector('.activity-panel') || document.querySelector('.activity-panel');

  let rawItems = [];
  if (scrapedData?.timeline && Array.isArray(scrapedData.timeline)) {
    rawItems = scrapedData.timeline;
  } else if (scrapedData?.messages?.messages && Array.isArray(scrapedData.messages.messages)) {
    rawItems = scrapedData.messages.messages;
  }

  if (rawItems.length === 0) {
    if (activityPanel) activityPanel.style.display = 'none';
    return;
  } else {
    if (activityPanel) activityPanel.style.display = '';
  }

  const posts = rawItems.filter(i => i.type === 'post').slice(0, 5);
  const comments = rawItems.filter(i => i.type === 'comment').slice(0, 5);
  
  const validTimelineItems = rawItems.filter(i => i.timestamp);
  validTimelineItems.sort((a, b) => b.timestamp - a.timestamp);
  const timelineLimit = validTimelineItems.slice(0, 10);

  // Render Posts
  if (posts.length === 0) {
     cPosts.parentElement.style.display = 'none';
  } else {
     cPosts.parentElement.style.display = '';
     cPosts.innerHTML = posts.map(item => `
      <div class="evidence-row" style="padding-bottom: var(--space-8); border-bottom: 1px dashed var(--border-neutral);">
        <div style="flex: 1; min-width: 0;" class="assessment-text">
          <span style="margin-right: 6px;">📄</span>
          ${Utils.escHtml(FormatUtils.truncatePost(item.text))}
        </div>
        ${item.timestamp ? `<div class="evidence-key" style="margin-left: var(--space-12); font-size: var(--text-meta); flex-shrink:0;">${Utils.formatTimeAgo(item.timestamp)}</div>` : ''}
      </div>
    `).join("");
  }

  // Render Comments
  if (comments.length === 0) {
     cComments.parentElement.style.display = 'none';
  } else {
     cComments.parentElement.style.display = '';
     cComments.innerHTML = comments.map(item => `
      <div class="evidence-row" style="padding-bottom: var(--space-8); border-bottom: 1px dashed var(--border-neutral);">
        <div style="flex: 1; min-width: 0;" class="assessment-text">
          <span style="margin-right: 6px;">💬</span>
          ${Utils.escHtml(FormatUtils.truncateComment(item.text))}
        </div>
        ${item.timestamp ? `<div class="evidence-key" style="margin-left: var(--space-12); font-size: var(--text-meta); flex-shrink:0;">${Utils.formatTimeAgo(item.timestamp)}</div>` : ''}
      </div>
    `).join("");
  }

  // Render Timeline
  if (timelineLimit.length === 0) {
     cTimeline.parentElement.style.display = 'none';
  } else {
     cTimeline.parentElement.style.display = '';
     cTimeline.innerHTML = timelineLimit.map(item => {
        const ts = FormatUtils.formatTimestamp(item.timestamp);
        const typeLabel = item.type === 'post' ? 'Post' : 'Comment';
        const textPreview = item.type === 'post' ? FormatUtils.truncatePost(item.text) : FormatUtils.truncateComment(item.text);
        
        return `
          <div style="display: flex; gap: var(--space-12); margin-bottom: var(--space-12);">
            <div style="width: 8px; height: 8px; border-radius: var(--radius-pill); background-color: var(--accent-blue); margin-top: 6px; flex-shrink: 0;"></div>
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <span class="evidence-key" style="font-family: var(--font-mono); font-size: var(--text-meta);">
                ${ts.date}, ${ts.time} &bull; ${typeLabel}
              </span>
              <span class="assessment-text" style="margin-top: 4px;">${Utils.escHtml(textPreview)}</span>
            </div>
          </div>
        `;
      }).join("");
  }
  
  if (posts.length === 0 && comments.length === 0 && timelineLimit.length === 0) {
    if (activityPanel) activityPanel.style.display = 'none';
  }
}

// ── 16. Export Utilities ──────────────────────────────────────────────────────
const ExportManager = {
  downloadPDF() {
    window.print(); // Relies on Electron native interception
  },
  
  exportJSON() {
    if (!AppState.apiResult || !AppState.scrapedData) return;
    
    const manifest = {
      intelliTrace_version: CONSTANTS.SYSTEM_VERSION,
      target_username: AppState.currentUsername,
      export_timestamp: new Date().toISOString(),
      ensemble_result: AppState.apiResult,
      raw_telemetry: AppState.scrapedData
    };
    
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const localUrl = URL.createObjectURL(blob);
    
    const anchor = document.createElement("a");
    anchor.href = localUrl;
    anchor.download = `ITR_Export_${AppState.currentUsername}_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    
    // Cleanup
    document.body.removeChild(anchor);
    URL.revokeObjectURL(localUrl);
  }
};