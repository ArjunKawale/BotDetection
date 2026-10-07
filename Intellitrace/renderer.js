/* ═══════════════════════════════════════════════════════════════════════════
   INTELLITRACE — SAAS RENDERER ENGINE (Vanilla JS + Chart.js)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CONFIGURATION & STATE ───────────────────────────────────────────────────

const VERDICT_CONFIG = {
  weights: {
    ideology: 0.25,
    aigen: 0.25,
    frequency: 0.25,
    rhythm: 0.25,
  },
  thresholds: {
    humanMax: 0.35,
    botMin: 0.65,
  },
};

const PARAM_TABS = ["param1", "param2", "param3", "param4"];

let appState = {
  currentPlatform: "reddit", // 'reddit' | 'bluesky'
  currentUser: null,
  currentTab: "param1",
  usersList: [],
  settings: { apiUrl: "http://localhost:8000", apiKey: "intellitrace_dev_key" },
  currentAnalysis: null,
  currentRawData: null,
  currentFormattedData: null,
  isScanning: false,
};

// Active Chart.js instances
const activeCharts = {
  landingRadar: null,
  landingDonutSemantic: null,
  landingGaugeAuthenticity: null,
  landingBulletCadence: null,
  landingBarCircadian: null,
  landingDemoRadar: null,
  overviewRadar: null,
  t1Donut: null,
  t1Bars: null,
  t2Gauge: null,
  t3Timeline: null,
  t4Circadian: null,
};

// Fallback for standalone browser testing & playwright screenshots
if (!window.api && !window.electronAPI) {
  const mockUsers = [
    { username: "Plus-Affect-6365", platform: "reddit", totalPosts: 42, hasAnalysis: true },
    { username: "echo.bsky.social", platform: "bluesky", totalPosts: 100, hasAnalysis: true }
  ];
  window.api = {
    listUsers: async (plat) => mockUsers.filter(u => plat === "all" || u.platform === plat),
    getUser: async (plat, uname) => {
      const isBsky = uname.includes(".");
      const sampleResult = {
        username: uname,
        overall_probability: isBsky ? 0.94 : 0.12,
        full_analysis: {
          ideology: {
            content_classification: isBsky ? "spam" : "normal_discussion",
            account_type: isBsky ? "likely_bot" : "human_user",
            pattern_description: isBsky
              ? "Identical templated health check reports syndicated across decentralized feeds with rigid syntactic structure."
              : "General conversational engagement across multiple subreddits (Linux ricing, gaming, career advice). Rich personal anecdotes and varied vocabulary.",
            bot_probability: isBsky ? 0.95 : 0.08,
            key_indicators: ["Topic diversity", "Slang usage", "Varied tone"]
          },
          ai_authenticity: {
            is_ai_generated: isBsky,
            ai_probability: isBsky ? 0.92 : 0.10,
            reasoning: isBsky
              ? "Formulaic automated phrases with consistent mechanical cadence."
              : "Conversational casual typos, colloquial abbreviations, and authentic human discussion."
          },
          frequency: { bot_probability: isBsky ? 0.96 : 0.14 },
          rhythm: { bot_probability: isBsky ? 0.98 : 0.16 }
        }
      };
      return {
        username: uname,
        platform: isBsky ? "bluesky" : "reddit",
        formatted: {
          frequency_data: isBsky ? 0.0416 : 3.33,
          rhythm_features: {
            total_posts: isBsky ? 100 : 42,
            median_gap_seconds: isBsky ? 3600 : 288288,
            top_of_hour_ratio: isBsky ? 0.98 : 0.02,
            hour_variance: isBsky ? 4.12 : 20.87,
            avg_sleep_hours: isBsky ? 1.2 : 896.25
          }
        },
        raw: {
          full_timestamp_timeline: Array.from({ length: 40 }, (_, i) => Math.floor(Date.now() / 1000) - i * 3600),
          timeline: []
        },
        analysis: sampleResult
      };
    },
    saveAnalysis: async () => true,
    loadSettings: async () => ({ apiUrl: "http://localhost:8000", apiKey: "intellitrace_dev_key" }),
    saveSettings: async () => true,
    onUsersUpdated: () => () => {},
    minimize: () => {},
    maximize: () => {},
    close: () => {},
    runScraper: () => {},
    onScraperEvent: () => () => {},
    redditLogin: async () => true
  };
  window.electronAPI = window.api;
}

// ── DOM ELEMENTS ────────────────────────────────────────────────────────────

const dom = {
  html: document.documentElement,
  body: document.body,
  viewLanding: document.getElementById("view-landing"),
  viewDashboard: document.getElementById("view-dashboard"),
  titlebarPlatformPill: document.getElementById("titlebar-platform-pill"),

  // Titlebar controls
  themeToggle: document.getElementById("theme-toggle"),
  settingsToggle: document.getElementById("settings-toggle"),
  btnWinMin: document.getElementById("btn-win-min"),
  btnWinMax: document.getElementById("btn-win-max"),
  btnWinClose: document.getElementById("btn-win-close"),

  // Sticky top nav
  headerNavMarketing: document.getElementById("header-nav-marketing"),
  headerNavDashboard: document.getElementById("header-nav-dashboard"),
  dashNavHome: document.getElementById("dash-nav-home"),
  topSwitchReddit: document.getElementById("top-switch-reddit"),
  topSwitchBluesky: document.getElementById("top-switch-bluesky"),
  navLinkLanding: document.getElementById("nav-link-landing"),
  navLinkReddit: document.getElementById("nav-link-reddit"),
  navLinkBluesky: document.getElementById("nav-link-bluesky"),
  navBtnReddit: document.getElementById("nav-btn-reddit"),
  navBtnBluesky: document.getElementById("nav-btn-bluesky"),

  // Landing page elements
  heroBtnReddit: document.getElementById("hero-btn-reddit"),
  heroBtnBluesky: document.getElementById("hero-btn-bluesky"),
  landingCountReddit: document.getElementById("landing-count-reddit"),
  landingCountBluesky: document.getElementById("landing-count-bluesky"),
  splitCardReddit: document.getElementById("split-card-reddit"),
  splitCardBluesky: document.getElementById("split-card-bluesky"),
  splitRedditCount: document.getElementById("split-reddit-count"),
  splitBlueskyCount: document.getElementById("split-bluesky-count"),
  landingHeroRadar: document.getElementById("landing-hero-radar"),
  brandHomeLink: document.getElementById("brand-home-link"),
  ctaBtnReddit: document.getElementById("cta-btn-reddit"),
  ctaBtnBluesky: document.getElementById("cta-btn-bluesky"),
  landingDonutSemantic: document.getElementById("landing-donut-semantic"),
  landingGaugeAuthenticity: document.getElementById("landing-gauge-authenticity"),
  landingBulletCadence: document.getElementById("landing-bullet-cadence"),
  landingBarCircadian: document.getElementById("landing-bar-circadian"),
  landingDemoRadar: document.getElementById("landing-demo-radar"),
  demoTabHuman: document.getElementById("demo-tab-human"),
  demoTabHybrid: document.getElementById("demo-tab-hybrid"),
  demoTabBot: document.getElementById("demo-tab-bot"),
  demoUserHandle: document.getElementById("demo-user-handle"),
  demoUserSub: document.getElementById("demo-user-sub"),
  demoVerdictBadge: document.getElementById("demo-verdict-badge"),
  demoScoreSemantic: document.getElementById("demo-score-semantic"),
  demoScoreAuth: document.getElementById("demo-score-auth"),
  demoScoreCadence: document.getElementById("demo-score-cadence"),
  demoScoreRhythm: document.getElementById("demo-score-rhythm"),
  demoObsList: document.getElementById("demo-obs-list"),

  // Dashboard Header Band
  dashboardMascotImg: document.getElementById("dashboard-mascot-img"),
  platformPillBadge: document.getElementById("platform-pill-badge"),
  platformMainHeading: document.getElementById("platform-main-heading"),
  dashSwitchReddit: document.getElementById("dash-switch-reddit"),
  dashSwitchBluesky: document.getElementById("dash-switch-bluesky"),
  dashSearchInput: document.getElementById("dash-search-input"),
  dashUserDropdown: document.getElementById("dash-user-dropdown"),
  dashDropdownItems: document.getElementById("dash-dropdown-items"),
  btnDashScrape: document.getElementById("btn-dash-scrape"),
  btnDashScrapeText: document.getElementById("btn-dash-scrape-text"),
  dashScrapeSpinner: document.getElementById("dash-scrape-spinner"),

  // Telemetry Stepper & Terminal Drawer
  telemetryBar: document.getElementById("telemetry-bar"),
  telemetryActiveTarget: document.getElementById("telemetry-active-target"),
  telemetryStepper: document.getElementById("telemetry-stepper"),
  btnDashTerminalToggle: document.getElementById("btn-dash-terminal-toggle"),
  telemetryTerminalViewport: document.getElementById("telemetry-terminal-viewport"),
  telemetryLogLines: document.getElementById("telemetry-log-lines"),

  // Left Column: Profile Card & Semi-circle Gauge
  profileHandleText: document.getElementById("profile-handle-text"),
  profilePlatBadge: document.getElementById("profile-plat-badge"),
  profileAvatarLetter: document.getElementById("profile-avatar-letter"),
  profilePostsStat: document.getElementById("profile-posts-stat"),
  profileStorageBadge: document.getElementById("profile-storage-badge"),
  gaugeVerdictCanvas: document.getElementById("gauge-verdict-canvas"),
  gaugeScoreValue: document.getElementById("gauge-score-value"),
  verdictPillLabel: document.getElementById("verdict-pill-label"),
  verdictCaptionText: document.getElementById("verdict-caption-text"),
  btnReanalyzeUser: document.getElementById("btn-reanalyze-user"),
  recentUsersList: document.getElementById("recent-users-list"),
  recentProfilesCount: document.getElementById("recent-profiles-count"),

  // Right Column: Overview Section
  overviewRadarLarge: document.getElementById("overview-radar-large"),
  overviewConsensusChip: document.getElementById("overview-consensus-chip"),
  sqSemanticVal: document.getElementById("sq-semantic-val"),
  sqSemanticFill: document.getElementById("sq-semantic-fill"),
  sqSemanticDesc: document.getElementById("sq-semantic-desc"),
  sqAigenVal: document.getElementById("sq-aigen-val"),
  sqAigenFill: document.getElementById("sq-aigen-fill"),
  sqAigenDesc: document.getElementById("sq-aigen-desc"),
  sqCadenceVal: document.getElementById("sq-cadence-val"),
  sqCadenceFill: document.getElementById("sq-cadence-fill"),
  sqCadenceDesc: document.getElementById("sq-cadence-desc"),
  sqRhythmVal: document.getElementById("sq-rhythm-val"),
  sqRhythmFill: document.getElementById("sq-rhythm-fill"),
  sqRhythmDesc: document.getElementById("sq-rhythm-desc"),

  // Tabs Bar
  navParamTabs: document.querySelectorAll(".nav-param-tab"),
  tabsSlidingIndicator: document.getElementById("tabs-sliding-indicator"),
  chipScoreParam1: document.getElementById("chip-score-param1"),
  chipScoreParam2: document.getElementById("chip-score-param2"),
  chipScoreParam3: document.getElementById("chip-score-param3"),
  chipScoreParam4: document.getElementById("chip-score-param4"),
  paramPanels: document.querySelectorAll(".param-panel"),

  // Tab 1 (Semantic)
  t1VerdictSummary: document.getElementById("t1-verdict-summary"),
  chartT1Donut: document.getElementById("chart-t1-donut"),
  chartT1Bars: document.getElementById("chart-t1-bars"),
  t1IntentPill: document.getElementById("t1-intent-pill"),
  t1AccountPill: document.getElementById("t1-account-pill"),
  t1SignalsListBox: document.getElementById("t1-signals-list-box"),
  t1PatternNarrative: document.getElementById("t1-pattern-narrative"),
  t1ScorePct: document.getElementById("t1-score-pct"),
  t1ScoreBarFill: document.getElementById("t1-score-bar-fill"),

  // Tab 2 (AI Auth)
  t2VerdictSummary: document.getElementById("t2-verdict-summary"),
  chartT2Gauge: document.getElementById("chart-t2-gauge"),
  t2AiStatusName: document.getElementById("t2-ai-status-name"),
  t2AiStatusIndicator: document.getElementById("t2-ai-status-indicator"),
  t2ReasoningParagraph: document.getElementById("t2-reasoning-paragraph"),
  t2HallmarksList: document.getElementById("t2-hallmarks-list"),

  // Tab 3 (Posting Cadence)
  t3VerdictSummary: document.getElementById("t3-verdict-summary"),
  t3FrequencyNum: document.getElementById("t3-frequency-num"),
  t3BenchmarkNeedle: document.getElementById("t3-benchmark-needle"),
  chartT3Timeline: document.getElementById("chart-t3-timeline"),
  t3TotalPosts: document.getElementById("t3-total-posts"),
  t3ModelProb: document.getElementById("t3-model-prob"),
  t3CadenceVerdict: document.getElementById("t3-cadence-verdict"),

  // Tab 4 (Behavioral Rhythm)
  t4VerdictSummary: document.getElementById("t4-verdict-summary"),
  chartT4Circadian: document.getElementById("chart-t4-circadian"),
  t4HeatmapMatrix: document.getElementById("t4-heatmap-matrix"),
  t4TopOfHourVal: document.getElementById("t4-top-of-hour-val"),
  t4InactivityGapVal: document.getElementById("t4-inactivity-gap-val"),
  t4MedianGapVal: document.getElementById("t4-median-gap-val"),

  // Modal Settings
  settingsOverlay: document.getElementById("settings-overlay"),
  settingsCloseBtn: document.getElementById("settings-close-btn"),
  settingsCancelBtn: document.getElementById("settings-cancel-btn"),
  settingsSaveBtn: document.getElementById("settings-save-btn"),
  cfgUrl: document.getElementById("cfg-url"),
  cfgKey: document.getElementById("cfg-key"),
};

// ── CUSTOM HASH ROUTER ──────────────────────────────────────────────────────

function parseHash() {
  const raw = window.location.hash || "#/";
  const [pathPart, queryPart] = raw.slice(1).split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const params = new URLSearchParams(queryPart || "");

  return {
    path,
    user: params.get("user") || null,
    tab: params.get("tab") || "param1",
  };
}

function navigate(path, { user = null, tab = null } = {}, replace = false) {
  let h = `#${path}`;
  const params = new URLSearchParams();
  if (user) params.set("user", user);
  if (tab) params.set("tab", tab);
  const q = params.toString();
  if (q) h += `?${q}`;

  if (replace) {
    window.location.replace(h);
  } else {
    window.location.hash = h;
  }
}

async function handleRoute() {
  const { path, user, tab } = parseHash();

  if (path === "/" || path === "") {
    showLandingView();
  } else if (path === "/reddit" || path === "/bluesky") {
    const platform = path.slice(1);
    await showDashboardView(platform, user, tab);
  } else {
    navigate("/", {}, true);
  }
}

window.addEventListener("hashchange", handleRoute);

// ── VIEW MANAGEMENT ─────────────────────────────────────────────────────────

function showLandingView() {
  if (dom.viewLanding) dom.viewLanding.classList.add("active");
  if (dom.viewDashboard) dom.viewDashboard.classList.remove("active");

  if (dom.headerNavMarketing) dom.headerNavMarketing.classList.remove("hidden");
  if (dom.headerNavDashboard) dom.headerNavDashboard.classList.add("hidden");

  if (dom.navLinkLanding) dom.navLinkLanding.classList.add("active");
  if (dom.navLinkReddit) dom.navLinkReddit.classList.remove("active");
  if (dom.navLinkBluesky) dom.navLinkBluesky.classList.remove("active");

  refreshUserCounters();
  renderAllLandingVisualizations();
}

async function showDashboardView(platform, userParam, tabParam) {
  if (dom.viewLanding) dom.viewLanding.classList.remove("active");
  if (dom.viewDashboard) dom.viewDashboard.classList.add("active");

  if (dom.headerNavMarketing) dom.headerNavMarketing.classList.add("hidden");
  if (dom.headerNavDashboard) dom.headerNavDashboard.classList.remove("hidden");

  if (dom.navLinkLanding) dom.navLinkLanding.classList.remove("active");
  if (dom.navLinkReddit) dom.navLinkReddit.classList.toggle("active", platform === "reddit");
  if (dom.navLinkBluesky) dom.navLinkBluesky.classList.toggle("active", platform === "bluesky");

  setPlatform(platform);

  // Set active tab
  if (PARAM_TABS.includes(tabParam)) {
    activateTab(tabParam, false);
  } else {
    activateTab("param1", false);
  }

  // Reload disk users
  await reloadUsersList(platform);

  // Target user selection: verify user belongs to the current platform
  let targetUser = userParam;
  if (targetUser) {
    const exists = appState.usersList.some((u) => u.username === targetUser && u.platform === platform);
    if (!exists) targetUser = null;
  }

  if (!targetUser) {
    const available = appState.usersList.find((u) => u.platform === platform);
    if (available) {
      targetUser = available.username;
      navigate(`/${platform}`, { user: targetUser, tab: appState.currentTab }, true);
      return;
    }
  }

  if (targetUser) {
    await loadUserProfile(targetUser);
  } else {
    showEmptyProfileState();
  }
}

// ── PLATFORM & THEMING SYSTEM ───────────────────────────────────────────────

function setPlatform(platform) {
  appState.currentPlatform = platform;
  dom.html.setAttribute("data-platform", platform);
  dom.body.setAttribute("data-platform", platform);

  if (dom.titlebarPlatformPill) {
    dom.titlebarPlatformPill.textContent = platform === "reddit" ? "Reddit" : "Bluesky";
  }

  const isReddit = platform === "reddit";

  // Top navigation switcher pill
  if (dom.topSwitchReddit) {
    dom.topSwitchReddit.classList.toggle("active", isReddit);
    dom.topSwitchReddit.setAttribute("aria-selected", isReddit ? "true" : "false");
  }
  if (dom.topSwitchBluesky) {
    dom.topSwitchBluesky.classList.toggle("active", !isReddit);
    dom.topSwitchBluesky.setAttribute("aria-selected", !isReddit ? "true" : "false");
  }

  // Hero header switcher pill
  if (dom.dashSwitchReddit) {
    dom.dashSwitchReddit.classList.toggle("active", isReddit);
    dom.dashSwitchReddit.setAttribute("aria-selected", isReddit ? "true" : "false");
  }
  if (dom.dashSwitchBluesky) {
    dom.dashSwitchBluesky.classList.toggle("active", !isReddit);
    dom.dashSwitchBluesky.setAttribute("aria-selected", !isReddit ? "true" : "false");
  }

  // Header CTAs
  if (dom.navBtnReddit) dom.navBtnReddit.classList.toggle("active", isReddit);
  if (dom.navBtnBluesky) dom.navBtnBluesky.classList.toggle("active", !isReddit);

  if (isReddit) {
    if (dom.dashboardMascotImg) {
      dom.dashboardMascotImg.src = "assets/mascots/snoo.gif";
      dom.dashboardMascotImg.alt = "Reddit Snoo Mascot";
    }
    if (dom.platformPillBadge) dom.platformPillBadge.textContent = "REDDIT COMMUNITY FORENSICS";
    if (dom.platformMainHeading) dom.platformMainHeading.textContent = "Reddit Forensic Suite";
  } else {
    if (dom.dashboardMascotImg) {
      dom.dashboardMascotImg.src = "assets/mascots/bluesky.gif";
      dom.dashboardMascotImg.alt = "Bluesky Butterfly Mascot";
    }
    if (dom.platformPillBadge) dom.platformPillBadge.textContent = "AT PROTOCOL DECENTRALIZED FEEDS";
    if (dom.platformMainHeading) dom.platformMainHeading.textContent = "Bluesky Forensic Suite";
  }

  updateSlidingTabIndicator();
}

function getPlatformColors() {
  const isReddit = appState.currentPlatform === "reddit";
  return {
    primary: isReddit ? "#FF4500" : "#0085FF",
    secondary: isReddit ? "#FF8717" : "#00C2FF",
    primaryAlpha: isReddit ? "rgba(255, 69, 0, 0.22)" : "rgba(0, 133, 255, 0.22)",
    primaryBorder: isReddit ? "#FF4500" : "#0085FF",
  };
}

function setTheme(theme) {
  dom.html.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (dom.viewLanding && dom.viewLanding.classList.contains("active")) {
    renderAllLandingVisualizations();
  } else if (appState.currentAnalysis) {
    renderAllVisualizations();
  }
}

if (dom.themeToggle) {
  dom.themeToggle.addEventListener("click", () => {
    const curr = dom.html.getAttribute("data-theme") || "dark";
    setTheme(curr === "dark" ? "light" : "dark");
  });
}

// ── DATA MANAGEMENT & PROFILE LOADING ───────────────────────────────────────

async function reloadUsersList(platform = "all") {
  try {
    appState.usersList = await (window.api || window.electronAPI).listUsers(platform);
    renderRecentUsersList();
    renderSearchDropdown();
    refreshUserCounters();
  } catch (err) {
    console.error("[DATA] Failed to list users from disk:", err);
  }
}

function refreshUserCounters() {
  const rCount = appState.usersList.filter((u) => u.platform === "reddit").length;
  const bCount = appState.usersList.filter((u) => u.platform === "bluesky").length;

  if (dom.landingCountReddit) dom.landingCountReddit.textContent = rCount;
  if (dom.landingCountBluesky) dom.landingCountBluesky.textContent = bCount;
  if (dom.splitRedditCount) dom.splitRedditCount.textContent = rCount;
  if (dom.splitBlueskyCount) dom.splitBlueskyCount.textContent = bCount;
  if (dom.recentProfilesCount) {
    dom.recentProfilesCount.textContent = appState.usersList.filter(
      (u) => u.platform === appState.currentPlatform
    ).length;
  }
}

function renderRecentUsersList() {
  const filtered = appState.usersList.filter(
    (u) => u.platform === appState.currentPlatform
  );

  dom.recentUsersList.innerHTML = "";
  if (filtered.length === 0) {
    dom.recentUsersList.innerHTML = `
      <div style="padding:14px; text-align:center; color:var(--text-muted); font-size:13px;">
        No cached profiles on disk. Enter a handle above to scrape.
      </div>
    `;
    return;
  }

  filtered.forEach((user) => {
    const item = document.createElement("div");
    item.className = "recent-user-item";
    if (appState.currentUser === user.username) item.classList.add("active");

    const prefix = user.platform === "bluesky" ? "@" : "u/";
    item.innerHTML = `
      <span class="rui-handle">${prefix}${escapeHtml(user.username)}</span>
      <span class="rui-chip chip-${user.hasAnalysis ? "uncertain" : "human"}">
        ${user.totalPosts} posts
      </span>
    `;

    item.addEventListener("click", () => {
      navigate(`/${appState.currentPlatform}`, {
        user: user.username,
        tab: appState.currentTab,
      });
    });

    dom.recentUsersList.appendChild(item);
  });
}

function renderSearchDropdown() {
  const filtered = appState.usersList.filter(
    (u) => u.platform === appState.currentPlatform
  );

  dom.dashDropdownItems.innerHTML = "";
  if (filtered.length === 0) {
    dom.dashDropdownItems.innerHTML = `
      <div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">
        No matching profiles. Click 'Scrape &amp; Analyze' to retrieve.
      </div>
    `;
    return;
  }

  filtered.forEach((user) => {
    const row = document.createElement("div");
    row.className = "dropdown-item-row";
    if (appState.currentUser === user.username) row.classList.add("active");

    const prefix = user.platform === "bluesky" ? "@" : "u/";
    row.innerHTML = `
      <span class="dir-user">${prefix}${escapeHtml(user.username)}</span>
      <span class="dir-posts">${user.totalPosts} posts</span>
    `;

    row.addEventListener("click", () => {
      dom.dashUserDropdown.classList.add("hidden");
      navigate(`/${appState.currentPlatform}`, {
        user: user.username,
        tab: appState.currentTab,
      });
    });

    dom.dashDropdownItems.appendChild(row);
  });
}

async function loadUserProfile(username) {
  if (!username) return;
  appState.currentUser = username;

  // IMPORTANT: ALWAYS synchronize search input to currently selected user!
  const prefix = appState.currentPlatform === "bluesky" ? "@" : "u/";
  dom.dashSearchInput.value = `${prefix}${username}`;

  // Update profile card header
  dom.profileHandleText.textContent = `${prefix}${username}`;
  dom.profileAvatarLetter.textContent = username.charAt(0).toUpperCase();
  dom.profilePlatBadge.textContent = appState.currentPlatform.toUpperCase();

  renderRecentUsersList();

  try {
    const profile = await (window.api || window.electronAPI).getUser(
      appState.currentPlatform,
      username
    );

    appState.currentFormattedData = profile.formatted;
    appState.currentRawData = profile.raw;

    const posts =
      profile.formatted?.rhythm_features?.total_posts ||
      profile.raw?.timeline?.length ||
      profile.raw?.full_timestamp_timeline?.length ||
      0;
    dom.profilePostsStat.textContent = `${posts} posts analyzed`;

    if (profile.analysis) {
      dom.profileStorageBadge.textContent = "Persisted Analysis";
      appState.currentAnalysis = profile.analysis;
      renderAllVisualizations();
    } else if (profile.formatted) {
      dom.profileStorageBadge.textContent = "Formatted JSON";
      await executeAnalysisPipeline(username, profile.formatted);
    } else {
      dom.profileStorageBadge.textContent = "Raw Data Missing";
      showEmptyProfileState();
    }
  } catch (err) {
    console.error("[PROFILE] Error loading user profile:", err);
  }
}

function showEmptyProfileState() {
  dom.profileHandleText.textContent = "No Profile Selected";
  dom.profilePostsStat.textContent = "0 posts";
  dom.verdictPillLabel.textContent = "WAITING";
  dom.verdictPillLabel.className = "verdict-pill-label";
  dom.gaugeScoreValue.textContent = "0";
  drawSemiCircleGauge(0, "#A8AAAE");
}

// ── VERDICT ENGINE & VISUALIZATIONS ─────────────────────────────────────────

function computeWeightedVerdict(analysis) {
  const fa = analysis.full_analysis || {};
  const ideologyProb =
    fa.ideology?.bot_probability ?? analysis.ideology?.bot_probability ?? 0;
  const aigenProb =
    fa.ai_authenticity?.ai_probability ?? analysis.ai_authenticity?.ai_probability ?? 0;
  const freqProb =
    fa.frequency?.bot_probability ?? analysis.frequency?.bot_probability ?? 0;
  const rhythmProb =
    fa.rhythm?.bot_probability ?? analysis.rhythm?.bot_probability ?? 0;

  const w = VERDICT_CONFIG.weights;
  const weightedProb =
    ideologyProb * w.ideology +
    aigenProb * w.aigen +
    freqProb * w.frequency +
    rhythmProb * w.rhythm;

  let label = "Uncertain";
  let tagClass = "uncertain";
  let color = "var(--risk-uncertain)";

  if (weightedProb < VERDICT_CONFIG.thresholds.humanMax) {
    label = "Likely Human";
    tagClass = "human";
    color = "var(--risk-human)";
  } else if (weightedProb > VERDICT_CONFIG.thresholds.botMin) {
    label = "Likely Bot";
    tagClass = "bot";
    color = "var(--risk-bot)";
  }

  return {
    weightedProb,
    label,
    tagClass,
    color,
    scores: {
      ideology: ideologyProb,
      aigen: aigenProb,
      frequency: freqProb,
      rhythm: rhythmProb,
    },
  };
}

function renderAllVisualizations() {
  if (!appState.currentAnalysis) return;
  const verdict = computeWeightedVerdict(appState.currentAnalysis);
  const pct = Math.round(verdict.weightedProb * 100);

  // 1. Semi-Circle Verdict Gauge (0-100)
  dom.gaugeScoreValue.textContent = pct;
  dom.verdictPillLabel.textContent = verdict.label;
  dom.verdictPillLabel.className = `verdict-pill-label ${verdict.tagClass}`;

  const gaugeColor =
    verdict.tagClass === "human"
      ? "#10B981"
      : verdict.tagClass === "bot"
      ? "#EF4444"
      : "#F59E0B";
  drawSemiCircleGauge(pct, gaugeColor);

  if (verdict.tagClass === "human") {
    dom.verdictCaptionText.textContent =
      "Telemetry strongly aligns with organic human discourse, circadian cycles, and typing entropy.";
    dom.overviewConsensusChip.textContent = `Consensus: Likely Human (${pct}%)`;
  } else if (verdict.tagClass === "bot") {
    dom.verdictCaptionText.textContent =
      "Strong synthetic signatures across machine intervals, top-of-hour crons, or LLM-generated text.";
    dom.overviewConsensusChip.textContent = `Consensus: Likely Bot (${pct}%)`;
  } else {
    dom.verdictCaptionText.textContent =
      "Mixed telemetry: Potential human-curated bot, scheduler tool, or hybrid account.";
    dom.overviewConsensusChip.textContent = `Consensus: Uncertain (${pct}%)`;
  }

  // 2. 2x2 Quadrant Stat Cards
  const pIdeo = Math.round(verdict.scores.ideology * 100);
  const pAi = Math.round(verdict.scores.aigen * 100);
  const pCad = Math.round(verdict.scores.frequency * 100);
  const pRhy = Math.round(verdict.scores.rhythm * 100);

  dom.sqSemanticVal.textContent = `${pIdeo}%`;
  dom.sqSemanticFill.style.width = `${pIdeo}%`;
  dom.sqAigenVal.textContent = `${pAi}%`;
  dom.sqAigenFill.style.width = `${pAi}%`;
  dom.sqCadenceVal.textContent = `${pCad}%`;
  dom.sqCadenceFill.style.width = `${pCad}%`;
  dom.sqRhythmVal.textContent = `${pRhy}%`;
  dom.sqRhythmFill.style.width = `${pRhy}%`;

  // 3. Tab Chips
  dom.chipScoreParam1.textContent = `${pIdeo}%`;
  dom.chipScoreParam2.textContent = `${pAi}%`;
  dom.chipScoreParam3.textContent = `${pCad}%`;
  dom.chipScoreParam4.textContent = `${pRhy}%`;

  // 4. Large Overview Radar Chart (min 420px)
  renderOverviewRadar(verdict);

  // 5. Parameter Tab Visualizations
  renderTab1Semantic(verdict);
  renderTab2AiAuth(verdict);
  renderTab3Cadence(verdict);
  renderTab4Rhythm(verdict);
}

// ── CANVAS SEMI-CIRCLE GAUGE ────────────────────────────────────────────────

function drawSemiCircleGauge(pct, strokeColor) {
  const canvas = dom.gaugeVerdictCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h - 16;
  const radius = Math.min(cx - 24, cy - 10);
  const lineWidth = 16;

  // Background track (semi-circle)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 0, false);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineCap = "round";
  ctx.stroke();

  // Progress arc
  const endAngle = Math.PI + (pct / 100) * Math.PI;
  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, endAngle, false);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

// ── OVERVIEW RADAR CHART (Chart.js) ─────────────────────────────────────────

function renderOverviewRadar(verdict) {
  if (!window.Chart || !dom.overviewRadarLarge) return;
  if (activeCharts.overviewRadar) activeCharts.overviewRadar.destroy();

  const colors = getPlatformColors();
  const isDark = (dom.html.getAttribute("data-theme") || "dark") === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textColor = isDark ? "#A8AAAE" : "#4A4D53";

  const ctx = dom.overviewRadarLarge.getContext("2d");
  activeCharts.overviewRadar = new Chart(ctx, {
    type: "radar",
    data: {
      labels: [
        ["1. Semantic", "Intent"],
        ["2. AI Text", "Authenticity"],
        ["3. Posting", "Cadence"],
        ["4. Circadian", "Rhythm"],
      ],
      datasets: [
        {
          label: "Bot Likelihood",
          data: [
            Math.round(verdict.scores.ideology * 100),
            Math.round(verdict.scores.aigen * 100),
            Math.round(verdict.scores.frequency * 100),
            Math.round(verdict.scores.rhythm * 100),
          ],
          backgroundColor: colors.primaryAlpha,
          borderColor: colors.primary,
          borderWidth: 2.5,
          pointBackgroundColor: colors.primary,
          pointBorderColor: "#FFFFFF",
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 14,
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: {
            color: textColor,
            font: { size: 12, weight: "600", family: "Inter, sans-serif" },
            padding: 8,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => Array.isArray(items[0]?.label) ? items[0].label.join(" ") : items[0]?.label,
            label: (item) => ` ${item.raw}% bot likelihood`,
          },
        },
      },
    },
  });
}


// ── DEMO PROFILES DATA & INTERACTIVE LANDING VISUALIZATIONS ────────────────

const DEMO_PROFILES = {
  human: {
    handle: "u/Plus-Affect-6365",
    sub: "Casual community discussion account",
    verdict: "Likely Human (12%)",
    badgeClass: "badge-human",
    scores: { semantic: "8%", auth: "10%", cadence: "14%", rhythm: "16%" },
    radar: [8, 10, 14, 16],
    observations: [
      "Organic vocabulary entropy across varied subreddits",
      "Casual typos, natural abbreviations, zero academic filler",
      "Human posting cadence with 3.3 days median dormancy",
      "Normal 8-hour human biological sleep window detected",
    ],
  },
  hybrid: {
    handle: "u/Astro_Opinion_Net",
    sub: "Coordinated astroturf narrative promoter",
    verdict: "Uncertain / Hybrid (54%)",
    badgeClass: "badge-uncertain",
    scores: { semantic: "78%", auth: "22%", cadence: "65%", rhythm: "48%" },
    radar: [78, 22, 65, 48],
    observations: [
      "High topical repetitiveness and coordinated talking points",
      "Human-written comments (low synthetic LLM syntax markers)",
      "Periodic high-volume posting surges during active campaigns",
      "Irregular sleep schedule with occasional multi-day dormancy",
    ],
  },
  bot: {
    handle: "@echo.bsky.social",
    sub: "Automated syndication & broadcast account",
    verdict: "Likely Bot (95%)",
    badgeClass: "badge-bot",
    scores: { semantic: "95%", auth: "92%", cadence: "96%", rhythm: "98%" },
    radar: [95, 92, 96, 98],
    observations: [
      "Repetitive syndicate broadcast narrative syntax",
      "Formulaic LLM sentence structure and agreeable transitions",
      "Machine cadence with <1 min interval post bursts",
      "Unbroken 24/7 activity with top-of-hour (:00) cron spikes",
    ],
  },
};
let activeDemoProfile = "human";

function renderAllLandingVisualizations() {
  renderLandingMockupRadar();
  renderLandingDonutSemantic();
  renderLandingGaugeAuthenticity();
  renderLandingBulletCadence();
  renderLandingBarCircadian();
  renderLandingDemoRadar(activeDemoProfile);
}

// ── LANDING HERO RADAR MOCKUP ───────────────────────────────────────────────

function renderLandingMockupRadar() {
  if (!window.Chart || !dom.landingHeroRadar) return;
  if (activeCharts.landingRadar) activeCharts.landingRadar.destroy();

  const isDark = (dom.html.getAttribute("data-theme") || "light") === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(11, 13, 18, 0.08)";
  const textColor = isDark ? "#A8AAAE" : "#5B6270";

  const ctx = dom.landingHeroRadar.getContext("2d");
  activeCharts.landingRadar = new Chart(ctx, {
    type: "radar",
    data: {
      labels: [
        ["1. Semantic", "Intent"],
        ["2. Text", "Authenticity"],
        ["3. Posting", "Cadence"],
        ["4. Circadian", "Rhythm"],
      ],
      datasets: [
        {
          label: "Organic Human Sample",
          data: [8, 10, 14, 16],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "#10B981",
          borderWidth: 2,
          pointBackgroundColor: "#10B981",
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 12 },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: {
            color: textColor,
            font: { size: 11, weight: "600", family: "Inter, sans-serif" },
            padding: 6,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => Array.isArray(items[0]?.label) ? items[0].label.join(" ") : items[0]?.label,
            label: (item) => ` ${item.raw}% bot likelihood`,
          },
        },
      },
    },
  });
}

// ── FEATURE 1: SEMANTIC DONUT ───────────────────────────────────────────────

function renderLandingDonutSemantic() {
  if (!window.Chart || !dom.landingDonutSemantic) return;
  if (activeCharts.landingDonutSemantic) activeCharts.landingDonutSemantic.destroy();

  const ctx = dom.landingDonutSemantic.getContext("2d");
  activeCharts.landingDonutSemantic = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Organic Discourse", "Technical Q&A", "Community Gaming", "Agenda Cluster"],
      datasets: [
        {
          data: [55, 25, 15, 5],
          backgroundColor: ["#10B981", "#0085FF", "#8B5CF6", "#FF4500"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${item.raw}% of posts`,
          },
        },
      },
    },
  });
}

// ── FEATURE 2: AUTHENTICITY GAUGE ───────────────────────────────────────────

function renderLandingGaugeAuthenticity() {
  if (!window.Chart || !dom.landingGaugeAuthenticity) return;
  if (activeCharts.landingGaugeAuthenticity) activeCharts.landingGaugeAuthenticity.destroy();

  const isDark = (dom.html.getAttribute("data-theme") || "light") === "dark";
  const trackBg = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(11, 13, 18, 0.08)";

  const ctx = dom.landingGaugeAuthenticity.getContext("2d");
  activeCharts.landingGaugeAuthenticity = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["AI Probability", "Organic Human"],
      datasets: [
        {
          data: [10, 90],
          backgroundColor: ["#F59E0B", trackBg],
          circumference: 180,
          rotation: 270,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${item.raw}%`,
          },
        },
      },
    },
  });
}

// ── FEATURE 3: CADENCE BULLET CHART ─────────────────────────────────────────

function renderLandingBulletCadence() {
  if (!window.Chart || !dom.landingBulletCadence) return;
  if (activeCharts.landingBulletCadence) activeCharts.landingBulletCadence.destroy();

  const isDark = (dom.html.getAttribute("data-theme") || "light") === "dark";
  const textColor = isDark ? "#A8AAAE" : "#5B6270";

  const ctx = dom.landingBulletCadence.getContext("2d");
  activeCharts.landingBulletCadence = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Velocity"],
      datasets: [
        {
          label: "Machine (<0.1d)",
          data: [10],
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          stack: "ranges",
        },
        {
          label: "Active Human (0.1-2d)",
          data: [40],
          backgroundColor: "rgba(16, 185, 129, 0.8)",
          stack: "ranges",
        },
        {
          label: "Casual User (>2d)",
          data: [50],
          backgroundColor: "rgba(0, 133, 255, 0.8)",
          stack: "ranges",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          display: true,
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { size: 10, family: "Inter, sans-serif" },
            callback: (v) => `${v}%`,
          },
        },
        y: { stacked: true, display: false },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw}% zone`,
          },
        },
      },
    },
  });
}

// ── FEATURE 4: CIRCADIAN HISTOGRAM ──────────────────────────────────────────

function renderLandingBarCircadian() {
  if (!window.Chart || !dom.landingBarCircadian) return;
  if (activeCharts.landingBarCircadian) activeCharts.landingBarCircadian.destroy();

  const isDark = (dom.html.getAttribute("data-theme") || "light") === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(11, 13, 18, 0.06)";
  const textColor = isDark ? "#A8AAAE" : "#5B6270";

  const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
  // Natural human curve: sleep 0h-7h, active 8h-23h
  const data = [0, 0, 0, 0, 0, 0, 1, 3, 5, 8, 12, 10, 14, 16, 15, 18, 20, 17, 14, 11, 8, 4, 2, 1];

  const ctx = dom.landingBarCircadian.getContext("2d");
  activeCharts.landingBarCircadian = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: "#8B5CF6",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { size: 9, family: "Inter, sans-serif" },
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: gridColor },
          ticks: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `UTC ${items[0]?.label}`,
            label: (item) => ` ${item.raw} posts recorded`,
          },
        },
      },
    },
  });
}

// ── INTERACTIVE DEMO RADAR ──────────────────────────────────────────────────

function renderLandingDemoRadar(profileKey) {
  if (!window.Chart || !dom.landingDemoRadar) return;
  if (activeCharts.landingDemoRadar) activeCharts.landingDemoRadar.destroy();

  const profile = DEMO_PROFILES[profileKey] || DEMO_PROFILES.human;
  const isDark = (dom.html.getAttribute("data-theme") || "light") === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(11, 13, 18, 0.08)";
  const textColor = isDark ? "#A8AAAE" : "#5B6270";

  let color = "#10B981";
  let bgAlpha = "rgba(16, 185, 129, 0.25)";
  if (profileKey === "hybrid") {
    color = "#F59E0B";
    bgAlpha = "rgba(245, 158, 11, 0.25)";
  } else if (profileKey === "bot") {
    color = "#EF4444";
    bgAlpha = "rgba(239, 68, 68, 0.25)";
  }

  const ctx = dom.landingDemoRadar.getContext("2d");
  activeCharts.landingDemoRadar = new Chart(ctx, {
    type: "radar",
    data: {
      labels: [
        ["1. Semantic", "Intent"],
        ["2. Text", "Authenticity"],
        ["3. Posting", "Cadence"],
        ["4. Circadian", "Rhythm"],
      ],
      datasets: [
        {
          label: profile.handle,
          data: profile.radar,
          backgroundColor: bgAlpha,
          borderColor: color,
          borderWidth: 2.5,
          pointBackgroundColor: color,
          pointBorderColor: "#FFFFFF",
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 14 },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: {
            color: textColor,
            font: { size: 12, weight: "600", family: "Inter, sans-serif" },
            padding: 8,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => Array.isArray(items[0]?.label) ? items[0].label.join(" ") : items[0]?.label,
            label: (item) => ` ${item.raw}% bot likelihood`,
          },
        },
      },
    },
  });
}

function switchDemoProfile(profileKey) {
  activeDemoProfile = profileKey;
  const p = DEMO_PROFILES[profileKey];
  if (!p) return;

  // Toggle button active classes
  if (dom.demoTabHuman) dom.demoTabHuman.classList.toggle("active", profileKey === "human");
  if (dom.demoTabHybrid) dom.demoTabHybrid.classList.toggle("active", profileKey === "hybrid");
  if (dom.demoTabBot) dom.demoTabBot.classList.toggle("active", profileKey === "bot");

  // Update text & scores
  if (dom.demoUserHandle) dom.demoUserHandle.textContent = p.handle;
  if (dom.demoUserSub) dom.demoUserSub.textContent = p.sub;
  if (dom.demoVerdictBadge) {
    dom.demoVerdictBadge.textContent = p.verdict;
    dom.demoVerdictBadge.className = `demo-verdict-badge ${p.badgeClass}`;
  }
  if (dom.demoScoreSemantic) dom.demoScoreSemantic.textContent = p.scores.semantic;
  if (dom.demoScoreAuth) dom.demoScoreAuth.textContent = p.scores.auth;
  if (dom.demoScoreCadence) dom.demoScoreCadence.textContent = p.scores.cadence;
  if (dom.demoScoreRhythm) dom.demoScoreRhythm.textContent = p.scores.rhythm;

  if (dom.demoObsList) {
    dom.demoObsList.innerHTML = p.observations
      .map((obs) => `<li>${escapeHtml(obs)}</li>`)
      .join("");
  }

  renderLandingDemoRadar(profileKey);
}


// ── TAB 1: SEMANTIC COHERENCE & IDEOLOGY ────────────────────────────────────

function renderTab1Semantic(verdict) {
  const fa = appState.currentAnalysis?.full_analysis || {};
  const ideo = fa.ideology || appState.currentAnalysis?.ideology || {};

  const intent = (ideo.content_classification || "normal_discussion").toLowerCase();
  dom.t1IntentPill.textContent = intent.toUpperCase();
  dom.t1AccountPill.textContent = (ideo.account_type || "human_user").toUpperCase();
  dom.t1PatternNarrative.textContent =
    ideo.pattern_description ||
    "Timeline displays varied discourse across multiple topics with organic lexical entropy.";

  const p = Math.round(verdict.scores.ideology * 100);
  dom.t1ScorePct.textContent = `${p}%`;
  dom.t1ScoreBarFill.style.width = `${p}%`;

  // Donut chart of classification
  if (activeCharts.t1Donut) activeCharts.t1Donut.destroy();
  if (dom.chartT1Donut) {
    const ctx = dom.chartT1Donut.getContext("2d");
    const isSpam = intent === "spam";
    const isProp = intent === "propaganda";
    const isDisc = intent === "normal_discussion";

    activeCharts.t1Donut = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Discussion", "Spam", "Propaganda", "Persona"],
        datasets: [
          {
            data: [
              isDisc ? 75 : 10,
              isSpam ? 70 : 10,
              isProp ? 70 : 10,
              10,
            ],
            backgroundColor: ["#10B981", "#EF4444", "#F59E0B", "#8B5CF6"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, font: { size: 12 } },
          },
        },
        cutout: "68%",
      },
    });
  }

  // Horizontal signals bar chart
  if (activeCharts.t1Bars) activeCharts.t1Bars.destroy();
  if (dom.chartT1Bars) {
    const ctx = dom.chartT1Bars.getContext("2d");
    activeCharts.t1Bars = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Topical Entropy", "Conversational Slang", "Spam Linkage", "Repetitive Phrasing"],
        datasets: [
          {
            data: [p < 35 ? 85 : 20, p < 35 ? 78 : 15, p, p > 50 ? 80 : 12],
            backgroundColor: [
              "#10B981",
              "#0085FF",
              p > 50 ? "#EF4444" : "#F59E0B",
              p > 50 ? "#EF4444" : "#10B981",
            ],
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { max: 100, grid: { display: false }, ticks: { display: false } },
          y: { grid: { display: false }, ticks: { font: { size: 12 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }
}

// ── TAB 2: TEXT AUTHENTICITY (AI-GEN) ───────────────────────────────────────

function renderTab2AiAuth(verdict) {
  const fa = appState.currentAnalysis?.full_analysis || {};
  const ai = fa.ai_authenticity || appState.currentAnalysis?.ai_authenticity || {};

  dom.t2ReasoningParagraph.textContent =
    ai.reasoning || "Natural phrasing and human conversational variances observed.";

  const aiProb = Math.round(verdict.scores.aigen * 100);
  const isAi = ai.is_ai_generated || aiProb > 50;

  dom.t2AiStatusName.textContent = isAi ? "SYNTHETIC MARKERS DETECTED" : "ORGANIC HUMAN WRITING";
  dom.t2AiStatusIndicator.style.color = isAi ? "var(--risk-bot)" : "var(--risk-human)";

  // Gauge Donut Chart
  if (activeCharts.t2Gauge) activeCharts.t2Gauge.destroy();
  if (dom.chartT2Gauge) {
    const ctx = dom.chartT2Gauge.getContext("2d");
    activeCharts.t2Gauge = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["AI Probability", "Human Probability"],
        datasets: [
          {
            data: [aiProb, 100 - aiProb],
            backgroundColor: [isAi ? "#EF4444" : "#F59E0B", "#10B981"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, font: { size: 12 } },
          },
        },
        cutout: "70%",
      },
    });
  }
}

// ── TAB 3: POSTING CADENCE (FREQUENCY) ──────────────────────────────────────

function renderTab3Cadence(verdict) {
  const freqVal =
    appState.currentFormattedData?.frequency_data ??
    appState.currentRawData?.rhythm_features_7_day_basis?.posting_frequency_days ??
    0;

  dom.t3FrequencyNum.textContent = Number(freqVal).toFixed(2);
  dom.t3TotalPosts.textContent = dom.profilePostsStat.textContent.split(" ")[0] || "100";
  dom.t3ModelProb.textContent = `${Math.round(verdict.scores.frequency * 100)}%`;

  if (freqVal < 0.1) {
    dom.t3CadenceVerdict.textContent = "MACHINE BURST SYNDICATION";
    dom.t3CadenceVerdict.style.color = "var(--risk-bot)";
  } else if (freqVal <= 3.0) {
    dom.t3CadenceVerdict.textContent = "ACTIVE COMMUNITY PARTICIPATION";
    dom.t3CadenceVerdict.style.color = "var(--risk-human)";
  } else {
    dom.t3CadenceVerdict.textContent = "CASUAL HUMAN INTERMITTENT";
    dom.t3CadenceVerdict.style.color = "var(--risk-human)";
  }

  // Needle positioning on bullet chart
  let needlePct = 50;
  if (freqVal < 0.1) needlePct = Math.max(5, (freqVal / 0.1) * 20);
  else if (freqVal <= 2.0) needlePct = 20 + ((freqVal - 0.1) / 1.9) * 40;
  else needlePct = Math.min(95, 60 + ((freqVal - 2.0) / 10.0) * 35);
  dom.t3BenchmarkNeedle.style.left = `${needlePct}%`;

  // Timeline Activity Area Chart
  if (activeCharts.t3Timeline) activeCharts.t3Timeline.destroy();
  if (dom.chartT3Timeline) {
    const ctx = dom.chartT3Timeline.getContext("2d");
    const rawTimes =
      appState.currentRawData?.full_timestamp_timeline ||
      (appState.currentRawData?.timeline || []).map((t) => t.timestamp).filter(Boolean);

    // Group timestamps by day index
    const dayCounts = new Array(7).fill(0);
    if (rawTimes && rawTimes.length > 0) {
      const minTs = Math.min(...rawTimes);
      const maxTs = Math.max(...rawTimes);
      const span = Math.max(1, maxTs - minTs);
      rawTimes.forEach((ts) => {
        const dIdx = Math.min(6, Math.floor(((ts - minTs) / span) * 7));
        dayCounts[dIdx]++;
      });
    } else {
      [8, 14, 12, 19, 15, 22, 10].forEach((v, i) => (dayCounts[i] = v));
    }

    const colors = getPlatformColors();
    activeCharts.t3Timeline = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
        datasets: [
          {
            label: "Actions Volume",
            data: dayCounts,
            borderColor: colors.primary,
            backgroundColor: colors.primaryAlpha,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { font: { size: 12 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }
}

// ── TAB 4: BEHAVIORAL RHYTHM (CIRCADIAN) ────────────────────────────────────

function renderTab4Rhythm(verdict) {
  const rf =
    appState.currentFormattedData?.rhythm_features ||
    appState.currentRawData?.rhythm_features_7_day_basis ||
    {};

  dom.t4TopOfHourVal.textContent = `${Math.round((rf.top_of_hour_ratio || 0) * 100)}%`;

  const sleepHrs = rf.avg_sleep_hours || 0;
  dom.t4InactivityGapVal.textContent =
    sleepHrs > 24
      ? `${(sleepHrs / 24).toFixed(1)} days`
      : `${Number(sleepHrs).toFixed(1)} hrs`;

  const medianSec = rf.median_gap_seconds || 0;
  dom.t4MedianGapVal.textContent =
    medianSec > 3600
      ? `${(medianSec / 3600).toFixed(1)} hrs`
      : `${Math.round(medianSec / 60)} mins`;

  // 24-Hour Circadian Bar Chart (UTC)
  if (activeCharts.t4Circadian) activeCharts.t4Circadian.destroy();
  if (dom.chartT4Circadian) {
    const ctx = dom.chartT4Circadian.getContext("2d");
    const hourCounts = new Array(24).fill(0);

    const rawTimes =
      appState.currentRawData?.full_timestamp_timeline ||
      (appState.currentRawData?.timeline || []).map((t) => t.timestamp).filter(Boolean);

    if (rawTimes && rawTimes.length > 0) {
      rawTimes.forEach((ts) => {
        const d = new Date(ts * 1000);
        const h = d.getUTCHours();
        if (h >= 0 && h < 24) hourCounts[h]++;
      });
    } else {
      [1, 0, 0, 0, 1, 2, 5, 8, 12, 14, 15, 11, 10, 12, 14, 16, 15, 13, 9, 6, 4, 2, 1, 1].forEach(
        (v, i) => (hourCounts[i] = v)
      );
    }

    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    const colors = getPlatformColors();

    activeCharts.t4Circadian = new Chart(ctx, {
      type: "bar",
      data: {
        labels: hourLabels,
        datasets: [
          {
            data: hourCounts,
            backgroundColor: colors.primary,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 12 },
              callback: (v, idx) => (idx % 4 === 0 ? hourLabels[idx] : ""),
            },
          },
          y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { font: { size: 12 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  // Day x Hour Heatmap Matrix Render
  dom.t4HeatmapMatrix.innerHTML = "";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  days.forEach((day, di) => {
    const col = document.createElement("div");
    col.className = "hm-day-col";
    col.innerHTML = `<span class="hm-day-title">${day}</span>`;
    for (let b = 0; b < 4; b++) {
      const cell = document.createElement("div");
      const lvl = (di + b) % 4;
      cell.className = `hm-cell ${lvl > 0 ? `level-${lvl}` : ""}`;
      col.appendChild(cell);
    }
    dom.t4HeatmapMatrix.appendChild(col);
  });
}

// ── FASTAPI SSE PIPELINE STREAMING ──────────────────────────────────────────

async function executeAnalysisPipeline(username, payload) {
  if (appState.isScanning) return;
  appState.isScanning = true;

  dom.telemetryBar.classList.remove("hidden");
  dom.telemetryActiveTarget.textContent = username;
  dom.telemetryLogLines.innerHTML = "";
  resetStepper();

  logToTerminal(`Initiating forensic analysis pipeline for ${username}...`, "info");
  updateStepper("scraping", "done");

  const url = `${appState.settings.apiUrl}/api/v1/process-user`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": appState.settings.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        if (event.step === "ideology") {
          updateStepper("ideology", "active");
          logToTerminal(event.message || "Evaluating semantic ideology...", "info");
        } else if (event.step === "aigen") {
          updateStepper("ideology", "done");
          updateStepper("aigen", "active");
          logToTerminal(event.message || "Evaluating AI text markers...", "info");
        } else if (event.step === "frequency") {
          updateStepper("aigen", "done");
          updateStepper("frequency", "active");
          logToTerminal(event.message || "Evaluating posting frequency...", "info");
        } else if (event.step === "rhythm") {
          updateStepper("frequency", "done");
          updateStepper("rhythm", "active");
          logToTerminal(event.message || "Evaluating circadian rhythm...", "info");
        } else if (event.step === "done") {
          updateStepper("rhythm", "done");
          logToTerminal("Multimodal analysis complete! Caching result...", "ok");

          appState.currentAnalysis = event.result;
          renderAllVisualizations();

          // Persist result_{username}.json in UserData/
          await (window.api || window.electronAPI).saveAnalysis(username, event.result);
          await reloadUsersList(appState.currentPlatform);

          setTimeout(() => {
            dom.telemetryBar.classList.add("hidden");
          }, 1500);
          break;
        } else if (event.step === "error") {
          logToTerminal(`API Error: ${event.message}`, "err");
          break;
        }
      }
    }
  } catch (err) {
    logToTerminal(`Pipeline Error: ${err.message}`, "err");
    console.error(err);
  } finally {
    appState.isScanning = false;
  }
}

// ── LIVE SCRAPER EXECUTION ──────────────────────────────────────────────────

if (dom.btnDashScrape) dom.btnDashScrape.addEventListener("click", triggerScraperRun);
if (dom.dashSearchInput) {
  dom.dashSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") triggerScraperRun();
  });
}

async function triggerScraperRun() {
  let target = dom.dashSearchInput.value.trim();
  if (!target || appState.isScanning) return;

  target = target.replace(/^u\//i, "").replace(/^@/, "");

  if (target.includes(".") && appState.currentPlatform !== "bluesky") {
    navigate("/bluesky", { user: target });
    return;
  }

  appState.isScanning = true;
  dom.btnDashScrape.disabled = true;
  dom.dashScrapeSpinner.classList.remove("hidden");
  dom.btnDashScrapeText.textContent = "Scraping...";

  dom.telemetryBar.classList.remove("hidden");
  dom.telemetryActiveTarget.textContent = target;
  dom.telemetryLogLines.innerHTML = "";
  resetStepper();
  updateStepper("scraping", "active");

  logToTerminal(`Executing scraper for: ${target}`, "info");

  const cleanup = (window.api || window.electronAPI).onScraperEvent(async (ev) => {
    if (ev.event === "stderr" && ev.data && ev.data.includes("AUTH_REQUIRED")) {
      logToTerminal("Reddit login required! Opening authentication window...", "warn");
      const logged = await (window.api || window.electronAPI).redditLogin();
      if (logged) {
        logToTerminal("Login successful! Retrying scrape...", "ok");
        (window.api || window.electronAPI).runScraper(target);
      } else {
        logToTerminal("Authentication cancelled.", "err");
        finishScrape(false);
      }
      return;
    }

    if (ev.event === "stdout") {
      logToTerminal(ev.data, "info");
    } else if (ev.event === "stderr") {
      logToTerminal(ev.data, "warn");
    } else if (ev.event === "done") {
      cleanup();
      logToTerminal("Scraper finished successfully.", "ok");
      updateStepper("scraping", "done");
      finishScrape(true, target);
    } else if (ev.event === "error") {
      cleanup();
      logToTerminal(`Scraper error: ${ev.data}`, "err");
      finishScrape(false);
    }
  });

  (window.api || window.electronAPI).runScraper(target);
}

async function finishScrape(success, targetUser = null) {
  dom.btnDashScrape.disabled = false;
  dom.dashScrapeSpinner.classList.add("hidden");
  dom.btnDashScrapeText.textContent = "Scrape & Analyze";
  appState.isScanning = false;

  if (success && targetUser) {
    await reloadUsersList(appState.currentPlatform);
    navigate(`/${appState.currentPlatform}`, {
      user: targetUser,
      tab: appState.currentTab,
    });
  }
}

// ── RE-ANALYZE BUTTON ───────────────────────────────────────────────────────

if (dom.btnReanalyzeUser) {
  dom.btnReanalyzeUser.addEventListener("click", async () => {
    if (!appState.currentUser || !appState.currentFormattedData) return;
    await executeAnalysisPipeline(appState.currentUser, appState.currentFormattedData);
  });
}

// ── STEPPER & TERMINAL HELPERS ──────────────────────────────────────────────

function updateStepper(stepName, status) {
  if (!dom.telemetryStepper) return;
  const step = dom.telemetryStepper.querySelector(`[data-step="${stepName}"]`);
  if (!step) return;
  step.classList.remove("active", "done", "error");
  if (status) step.classList.add(status);
}

function resetStepper() {
  if (!dom.telemetryStepper) return;
  dom.telemetryStepper.querySelectorAll(".tel-step").forEach((s) => {
    s.classList.remove("active", "done", "error");
  });
}

function logToTerminal(text, type = "info") {
  if (!dom.telemetryLogLines) return;
  const line = document.createElement("div");
  line.className = `log-line log-${type}`;
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  line.innerHTML = `<span style="color:#6E7178;">[${ts}]</span> ${escapeHtml(text)}`;
  dom.telemetryLogLines.appendChild(line);
  dom.telemetryLogLines.scrollTop = dom.telemetryLogLines.scrollHeight;
}

if (dom.btnDashTerminalToggle && dom.telemetryTerminalViewport) {
  dom.btnDashTerminalToggle.addEventListener("click", () => {
    dom.telemetryTerminalViewport.classList.toggle("collapsed");
  });
}

// ── TAB SWITCHING WITH SLIDING INDICATOR ────────────────────────────────────

function activateTab(tabId, updateRoute = true) {
  appState.currentTab = tabId;

  if (dom.navParamTabs) {
    dom.navParamTabs.forEach((tab) => {
      const isTarget = tab.getAttribute("data-tab") === tabId;
      tab.classList.toggle("active", isTarget);
      tab.setAttribute("aria-selected", isTarget ? "true" : "false");
    });
  }

  if (dom.paramPanels) {
    dom.paramPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-panel-${tabId}`);
    });
  }

  updateSlidingTabIndicator();

  if (updateRoute) {
    navigate(`/${appState.currentPlatform}`, {
      user: appState.currentUser,
      tab: tabId,
    });
  }
}

function updateSlidingTabIndicator() {
  const activeTab = document.querySelector(".nav-param-tab.active");
  const indicator = dom.tabsSlidingIndicator;
  if (activeTab && indicator) {
    indicator.style.left = `${activeTab.offsetLeft}px`;
    indicator.style.width = `${activeTab.offsetWidth}px`;
  }
}

window.addEventListener("resize", updateSlidingTabIndicator);

if (dom.navParamTabs) {
  dom.navParamTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tId = tab.getAttribute("data-tab");
      activateTab(tId, true);
    });
  });
}

// Overview quadrant cards click navigation
document.querySelectorAll(".stat-quadrant-card").forEach((card) => {
  card.addEventListener("click", () => {
    const target = card.getAttribute("data-tab-link");
    if (target) activateTab(target, true);
  });
});

// ── NAVIGATION & CONTROL HANDLERS ───────────────────────────────────────────

// Landing Buttons
if (dom.heroBtnReddit) dom.heroBtnReddit.addEventListener("click", () => navigate("/reddit"));
if (dom.heroBtnBluesky) dom.heroBtnBluesky.addEventListener("click", () => navigate("/bluesky"));
if (dom.splitCardReddit) dom.splitCardReddit.addEventListener("click", () => navigate("/reddit"));
if (dom.splitCardBluesky) dom.splitCardBluesky.addEventListener("click", () => navigate("/bluesky"));

// Additional Landing & Header CTAs
if (dom.ctaBtnReddit) dom.ctaBtnReddit.addEventListener("click", () => navigate("/reddit"));
if (dom.ctaBtnBluesky) dom.ctaBtnBluesky.addEventListener("click", () => navigate("/bluesky"));
if (dom.brandHomeLink) dom.brandHomeLink.addEventListener("click", (e) => { e.preventDefault(); navigate("/"); });

// Demo tab switches
if (dom.demoTabHuman) dom.demoTabHuman.addEventListener("click", () => switchDemoProfile("human"));
if (dom.demoTabHybrid) dom.demoTabHybrid.addEventListener("click", () => switchDemoProfile("hybrid"));
if (dom.demoTabBot) dom.demoTabBot.addEventListener("click", () => switchDemoProfile("bot"));

// Top Navbar
if (dom.navLinkLanding) dom.navLinkLanding.addEventListener("click", (e) => { e.preventDefault(); navigate("/"); });
if (dom.dashNavHome) dom.dashNavHome.addEventListener("click", (e) => { e.preventDefault(); navigate("/"); });
if (dom.topSwitchReddit) dom.topSwitchReddit.addEventListener("click", () => navigate("/reddit", { tab: appState.currentTab }));
if (dom.topSwitchBluesky) dom.topSwitchBluesky.addEventListener("click", () => navigate("/bluesky", { tab: appState.currentTab }));
if (dom.navLinkReddit) dom.navLinkReddit.addEventListener("click", (e) => { e.preventDefault(); navigate("/reddit"); });
if (dom.navLinkBluesky) dom.navLinkBluesky.addEventListener("click", (e) => { e.preventDefault(); navigate("/bluesky"); });
if (dom.navBtnReddit) dom.navBtnReddit.addEventListener("click", () => navigate("/reddit", { tab: appState.currentTab }));
if (dom.navBtnBluesky) dom.navBtnBluesky.addEventListener("click", () => navigate("/bluesky", { tab: appState.currentTab }));

// Dashboard hero header switcher
if (dom.dashSwitchReddit) dom.dashSwitchReddit.addEventListener("click", () => navigate("/reddit", { tab: appState.currentTab }));
if (dom.dashSwitchBluesky) dom.dashSwitchBluesky.addEventListener("click", () => navigate("/bluesky", { tab: appState.currentTab }));

// Search Dropdown visibility
if (dom.dashSearchInput && dom.dashUserDropdown) {
  dom.dashSearchInput.addEventListener("focus", () => {
    dom.dashUserDropdown.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!dom.dashSearchInput.contains(e.target) && !dom.dashUserDropdown.contains(e.target)) {
      dom.dashUserDropdown.classList.add("hidden");
    }
  });
}

// Native window controls
if (dom.btnWinMin) dom.btnWinMin.addEventListener("click", () => (window.api || window.electronAPI).minimize());
if (dom.btnWinMax) dom.btnWinMax.addEventListener("click", () => (window.api || window.electronAPI).maximize());
if (dom.btnWinClose) dom.btnWinClose.addEventListener("click", () => (window.api || window.electronAPI).close());

// Settings Modal
if (dom.settingsToggle) {
  dom.settingsToggle.addEventListener("click", () => {
    if (dom.cfgUrl) dom.cfgUrl.value = appState.settings.apiUrl;
    if (dom.cfgKey) dom.cfgKey.value = appState.settings.apiKey;
    if (dom.settingsOverlay) dom.settingsOverlay.classList.add("visible");
  });
}
if (dom.settingsCloseBtn && dom.settingsOverlay) dom.settingsCloseBtn.addEventListener("click", () => dom.settingsOverlay.classList.remove("visible"));
if (dom.settingsCancelBtn && dom.settingsOverlay) dom.settingsCancelBtn.addEventListener("click", () => dom.settingsOverlay.classList.remove("visible"));

if (dom.settingsSaveBtn && dom.settingsOverlay) {
  dom.settingsSaveBtn.addEventListener("click", async () => {
    if (dom.cfgUrl) appState.settings.apiUrl = dom.cfgUrl.value.replace(/\/$/, "");
    if (dom.cfgKey) appState.settings.apiKey = dom.cfgKey.value;
    await (window.api || window.electronAPI).saveSettings(appState.settings);
    dom.settingsOverlay.classList.remove("visible");
  });
}

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────

window.addEventListener("keydown", (e) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  // Ctrl/Cmd + 1: Reddit
  if (isCtrlOrCmd && e.key === "1") {
    e.preventDefault();
    navigate("/reddit", { tab: appState.currentTab });
    return;
  }

  // Ctrl/Cmd + 2: Bluesky
  if (isCtrlOrCmd && e.key === "2") {
    e.preventDefault();
    navigate("/bluesky", { tab: appState.currentTab });
    return;
  }

  // Ctrl/Cmd + K: Focus Search
  if (isCtrlOrCmd && e.key.toLowerCase() === "k") {
    e.preventDefault();
    dom.dashSearchInput.focus();
    dom.dashSearchInput.select();
    dom.dashUserDropdown.classList.remove("hidden");
    return;
  }

  // Ctrl/Cmd + Left/Right: Cycle tabs
  if (isCtrlOrCmd && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    const curr = PARAM_TABS.indexOf(appState.currentTab);
    const next =
      e.key === "ArrowRight"
        ? (curr + 1) % PARAM_TABS.length
        : (curr - 1 + PARAM_TABS.length) % PARAM_TABS.length;
    activateTab(PARAM_TABS[next], true);
    return;
  }

  // Escape: Close dropdowns or overlays
  if (e.key === "Escape") {
    dom.settingsOverlay.classList.remove("visible");
    dom.dashUserDropdown.classList.add("hidden");
  }
});

// ── FILE WATCHER ────────────────────────────────────────────────────────────

(window.api || window.electronAPI).onUsersUpdated(() => {
  console.log("[DATA] File watcher event: Reloading profiles...");
  reloadUsersList(appState.currentPlatform);
});

// ── UTILITIES ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── INIT ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    appState.settings = await (window.api || window.electronAPI).loadSettings();
  } catch (err) {}

  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);

  await reloadUsersList("all");
  await handleRoute();
})();