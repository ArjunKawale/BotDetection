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
          frequency: { bot_probability: isBsky ? 0.96 : 0.14, prediction: isBsky ? "bot" : "organic human", status: "Analyzed posting velocity." },
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
    onUsersUpdated: () => () => { },
    minimize: () => { },
    maximize: () => { },
    close: () => { },
    runScraper: () => { },
    onScraperEvent: () => () => { },
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
  t3TimelineTimespan: document.getElementById("t3-timeline-timespan"),
  t3TimelineActiveDays: document.getElementById("t3-timeline-active-days"),
  chartT3Timeline: document.getElementById("chart-t3-timeline"),
  t3TotalPosts: document.getElementById("t3-total-posts"),
  t3ModelProb: document.getElementById("t3-model-prob"),
  t3CadenceVerdict: document.getElementById("t3-cadence-verdict"),
  t3FeatBurst: document.getElementById("t3-feat-burst"),
  t3BarBurst: document.getElementById("t3-bar-burst"),
  t3FeatQuiet: document.getElementById("t3-feat-quiet"),
  t3BarQuiet: document.getElementById("t3-bar-quiet"),
  t3FeatDensity: document.getElementById("t3-feat-density"),
  t3BarDensity: document.getElementById("t3-bar-density"),
  t3FeatComment: document.getElementById("t3-feat-comment"),
  t3BarComment: document.getElementById("t3-bar-comment"),

  // Tab 4 (Behavioral Rhythm)
  t4VerdictSummary: document.getElementById("t4-verdict-summary"),
  t4ObservedSpan: document.getElementById("t4-observed-span"),
  t4ObservedDaysBadge: document.getElementById("t4-observed-days-badge"),
  t4MonthFilter: document.getElementById("t4-month-filter"),
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

  if (dom.navBtnBluesky) dom.navBtnBluesky.style.display = "";
  if (dom.navBtnReddit) dom.navBtnReddit.style.display = "";

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

  // Remove redundant button to current platform from top header
  if (dom.navBtnBluesky) dom.navBtnBluesky.style.display = platform === "bluesky" ? "none" : "";
  if (dom.navBtnReddit) dom.navBtnReddit.style.display = platform === "reddit" ? "none" : "";

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

async function loadUserProfile(username, forcePipeline = false) {
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

    // If no separate raw file exists but formatted JSON has timeline data, use it as fallback
    if (!appState.currentRawData && profile.formatted?.full_timestamp_timeline) {
      appState.currentRawData = {
        full_timestamp_timeline: profile.formatted.full_timestamp_timeline,
        timeline: [],
      };
    }

    const posts =
      profile.formatted?.rhythm_features?.total_posts ||
      profile.raw?.timeline?.length ||
      profile.raw?.full_timestamp_timeline?.length ||
      0;
    dom.profilePostsStat.textContent = `${posts} posts analyzed`;

    // Load the cache if we aren't forcing a fresh pipeline run
    if (!forcePipeline && profile.analysis) {
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

  let freqProb = fa.frequency?.bot_probability ?? analysis.frequency?.bot_probability ?? 0;
  // Normalize frequency probability just in case
  if (freqProb > 1.0) freqProb = freqProb / 100.0;

  const rhythmProb =
    fa.rhythm?.bot_probability ?? analysis.rhythm?.bot_probability ?? 0;

  // AI Authenticity is removed from the bot math
  // Distribute 100% across the 3 remaining models (Ideology, Cadence, Rhythm)
  const weightedProb = (ideologyProb * 0.50) + (freqProb * 0.25) + (rhythmProb * 0.25);
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

  // Populate stat card descriptions with real data from formatted JSON
  const cf = appState.currentFormattedData;
  if (cf) {
    const cadFt = cf.cadence_features || {};
    const rFt = cf.rhythm_features || {};
    const postsPerDay = cadFt.posts_per_active_day;
    const burstRatio = cadFt.burst_ratio;
    const medGap = rFt.median_gap_seconds;
    const topHour = rFt.top_of_hour_ratio;

    if (dom.sqCadenceDesc) {
      const ppd = postsPerDay != null ? `${postsPerDay.toFixed(1)} posts/active day` : "";
      const br = burstRatio != null ? ` · ${(burstRatio * 100).toFixed(0)}% burst` : "";
      dom.sqCadenceDesc.textContent = ppd + br || "Posting velocity analysis";
    }
    if (dom.sqRhythmDesc) {
      const mg = medGap != null
        ? medGap > 3600 ? `Median gap ${(medGap / 3600).toFixed(1)}h` : `Median gap ${Math.round(medGap / 60)}min`
        : "";
      const th = topHour != null ? ` · Top-of-hour: ${(topHour * 100).toFixed(0)}%` : "";
      dom.sqRhythmDesc.textContent = mg + th || "Circadian behaviour analysis";
    }
    if (dom.sqSemanticDesc) {
      const fa = appState.currentAnalysis?.full_analysis || {};
      const ideo = fa.ideology || appState.currentAnalysis?.ideology || {};
      dom.sqSemanticDesc.textContent = ideo.content_classification
        ? `${(ideo.content_classification).replace(/_/g, " ")} · ${ideo.account_type?.replace(/_/g, " ") || ""}`.trim()
        : "Semantic topic coherence";
    }
    if (dom.sqAigenDesc) {
      const fa = appState.currentAnalysis?.full_analysis || {};
      const ai = fa.ai_authenticity || appState.currentAnalysis?.ai_authenticity || {};
      dom.sqAigenDesc.textContent = ai.is_ai_generated
        ? "Synthetic text markers detected"
        : "Organic human writing detected";
    }
  }

  // 3. Tab Chips with Risk Badges
  const getRiskClass = (val) => (val < 35 ? "chip-human" : val > 65 ? "chip-bot" : "chip-uncertain");
  if (dom.chipScoreParam1) {
    dom.chipScoreParam1.textContent = `${pIdeo}%`;
    dom.chipScoreParam1.className = `tab-chip ${getRiskClass(pIdeo)}`;
  }
  if (dom.chipScoreParam2) {
    dom.chipScoreParam2.textContent = `${pAi}%`;
    dom.chipScoreParam2.className = `tab-chip ${getRiskClass(pAi)}`;
  }
  if (dom.chipScoreParam3) {
    dom.chipScoreParam3.textContent = `${pCad}%`;
    dom.chipScoreParam3.className = `tab-chip ${getRiskClass(pCad)}`;
  }
  if (dom.chipScoreParam4) {
    dom.chipScoreParam4.textContent = `${pRhy}%`;
    dom.chipScoreParam4.className = `tab-chip ${getRiskClass(pRhy)}`;
  }

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

  const isDark = (dom.html.getAttribute("data-theme") || "dark") === "dark";
  const trackColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";

  // Background track (semi-circle)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 0, false);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = trackColor;
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

  const isDark = (dom.html.getAttribute("data-theme") || "light") === "dark";
  const colors = isDark
    ? ["#3B82F6", "#60A5FA", "#93C5FD", "#334155"]
    : ["#1D4ED8", "#3B82F6", "#93C5FD", "#CBD5E1"];

  const ctx = dom.landingDonutSemantic.getContext("2d");
  activeCharts.landingDonutSemantic = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Organic Discourse", "Technical Q&A", "Community Gaming", "Agenda Cluster"],
      datasets: [
        {
          data: [55, 25, 15, 5],
          backgroundColor: colors,
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
  const gaugeColor = isDark ? "#60A5FA" : "#2563EB";

  const ctx = dom.landingGaugeAuthenticity.getContext("2d");
  activeCharts.landingGaugeAuthenticity = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["AI Probability", "Organic Human"],
      datasets: [
        {
          data: [10, 90],
          backgroundColor: [gaugeColor, trackBg],
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

  const colMachine = isDark ? "rgba(255, 255, 255, 0.12)" : "#CBD5E1";
  const colActive = isDark ? "rgba(96, 165, 250, 0.6)" : "#60A5FA";
  const colCasual = isDark ? "#3B82F6" : "#1D4ED8";

  const ctx = dom.landingBulletCadence.getContext("2d");
  activeCharts.landingBulletCadence = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Velocity"],
      datasets: [
        {
          label: "Automated (<0.1d)",
          data: [10],
          backgroundColor: colMachine,
          stack: "ranges",
        },
        {
          label: "Active Human (0.1-2d)",
          data: [40],
          backgroundColor: colActive,
          stack: "ranges",
        },
        {
          label: "Casual User (>2d)",
          data: [50],
          backgroundColor: colCasual,
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
  const barColor = isDark ? "rgba(96, 165, 250, 0.85)" : "#2563EB";

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
          backgroundColor: barColor,
          borderRadius: 2,
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


// ── HELPER: CHECK IF ACCOUNT HAS SCRAPED MESSAGES ──────────────────────────

function hasScrapedMessages() {
  // Direct negative signals from Gemini
  const ideo = appState.currentAnalysis?.full_analysis?.ideology;
  const ai = appState.currentAnalysis?.full_analysis?.ai_authenticity;
  if (
    ideo?.pattern_description &&
    /no messages were provided|no messages found|corpus empty/i.test(ideo.pattern_description)
  ) {
    return false;
  }
  if (
    Array.isArray(ideo?.key_indicators) &&
    ideo.key_indicators.some((k) =>
      /empty message|lack of activity|insufficient textual evidence/i.test(k)
    )
  ) {
    return false;
  }
  if (
    ai?.reasoning &&
    /no input text|no text available|no messages/i.test(ai.reasoning)
  ) {
    return false;
  }

  const formattedMsgs = appState.currentFormattedData?.messages?.messages;
  if (Array.isArray(formattedMsgs) && formattedMsgs.length > 0) return true;

  const rawTimeline = appState.currentRawData?.timeline;
  if (Array.isArray(rawTimeline) && rawTimeline.length > 0) return true;

  const rawTimestamps =
    appState.currentFormattedData?.full_timestamp_timeline ||
    appState.currentRawData?.full_timestamp_timeline;
  if (Array.isArray(rawTimestamps) && rawTimestamps.length > 0) return true;

  const totalPosts = appState.currentFormattedData?.rhythm_features?.total_posts || 0;
  if (totalPosts > 0) return true;

  // Fallback: If there's an analysis with indicators and no negative empty signals
  if (Array.isArray(ideo?.key_indicators) && ideo.key_indicators.length > 0) return true;

  return false;
}

// ── TAB 1: SEMANTIC COHERENCE & IDEOLOGY ────────────────────────────────────

function renderTab1Semantic(verdict) {
  const fa = appState.currentAnalysis?.full_analysis || {};
  const ideo = fa.ideology || appState.currentAnalysis?.ideology || {};
  const hasMessages = hasScrapedMessages();

  const intent = (ideo.content_classification || "normal_discussion").toLowerCase();
  const accountType = (ideo.account_type || "human_user").toLowerCase();
  const botProb = Math.round((ideo.bot_probability ?? verdict.scores.ideology ?? 0) * 100);

  // Intent & Account Pills
  if (!hasMessages) {
    dom.t1IntentPill.textContent = "NO_MESSAGES";
    dom.t1AccountPill.textContent = "UNVERIFIED";
  } else {
    dom.t1IntentPill.textContent = intent.toUpperCase();
    dom.t1AccountPill.textContent = accountType.toUpperCase();
  }

  // Narrative
  dom.t1PatternNarrative.textContent =
    ideo.pattern_description ||
    (hasMessages
      ? "Timeline displays varied discourse across multiple topics with organic lexical entropy."
      : "No public messages found in account timeline to evaluate topical narratives or repetitive phrasing.");

  // Verdict Summary Header
  if (dom.t1VerdictSummary) {
    if (!hasMessages) {
      dom.t1VerdictSummary.textContent =
        "Zero messages available. Ideology and narrative automation evaluation requires scraped posts or comments.";
    } else if (botProb > 50) {
      dom.t1VerdictSummary.textContent = `Account messages exhibit indicators of automated ${intent.replace(/_/g, " ")} (${botProb}% ideology risk).`;
    } else {
      dom.t1VerdictSummary.textContent = `Account exhibits organic topic diversity and normal human conversational variation (${botProb}% ideology score).`;
    }
  }

  // Ideology Automation Score Meter
  const scoreVal = hasMessages ? botProb : 0;
  dom.t1ScorePct.textContent = `${scoreVal}%`;
  dom.t1ScoreBarFill.style.width = `${scoreVal}%`;

  // Donut chart of classification
  if (activeCharts.t1Donut) activeCharts.t1Donut.destroy();
  if (dom.chartT1Donut) {
    const ctx = dom.chartT1Donut.getContext("2d");

    let donutLabels = [];
    let donutData = [];
    let donutColors = [];

    if (!hasMessages) {
      donutLabels = ["No Messages Found"];
      donutData = [100];
      donutColors = ["#334155"];
    } else {
      const isHighRisk = botProb > 50;
      const primaryLabel =
        intent === "spam"
          ? "Spam / Promotion"
          : intent === "propaganda"
            ? "Propaganda Narrative"
            : intent === "running_bit"
              ? "Recurring Persona"
              : "Organic Discussion";

      if (isHighRisk) {
        donutLabels = [primaryLabel, "Organic Content"];
        donutData = [botProb, Math.max(0, 100 - botProb)];
        donutColors = ["#EF4444", "#334155"];
      } else {
        donutLabels = [primaryLabel, "Automation / Risk"];
        donutData = [Math.max(0, 100 - botProb), botProb];
        donutColors = ["#3B82F6", "#334155"];
      }
    }

    activeCharts.t1Donut = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: donutLabels,
        datasets: [
          {
            data: donutData,
            backgroundColor: donutColors,
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
            labels: { boxWidth: 10, font: { size: 12 }, color: "#94A3B8" },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (!hasMessages) return " No message corpus available to classify";
                return ` ${context.label}: ${context.parsed}%`;
              },
            },
          },
        },
        cutout: "68%",
      },
    });
  }

  // Dynamic Forensic Key Indicators (Card 2)
  if (dom.t1SignalsListBox) {
    const rawIndicators = Array.isArray(ideo.key_indicators) ? ideo.key_indicators : [];

    if (!hasMessages) {
      const emptyNotes =
        rawIndicators.length > 0
          ? rawIndicators.map((k) => `<li>${escapeHtml(k)}</li>`).join("")
          : "<li>Account has 0 public posts or comments scraped.</li>";
      dom.t1SignalsListBox.innerHTML = `
        <div class="sig-empty-notice">
          <strong>No Textual Corpus Available</strong>
          <span>Gemini verified the following constraints from profile metadata:</span>
          <ul class="sig-empty-bullets">${emptyNotes}</ul>
        </div>
      `;
    } else if (rawIndicators.length === 0) {
      dom.t1SignalsListBox.innerHTML = `
        <div class="sig-empty-notice">
          <strong>No Distinct Signals Flagged</strong>
          <span>Linguistic analysis did not flag any anomalous narrative patterns or automated spam signatures.</span>
        </div>
      `;
    } else {
      dom.t1SignalsListBox.innerHTML = rawIndicators
        .map((indicator, idx) => {
          const num = String(idx + 1).padStart(2, "0");
          return `
            <div class="sig-item">
              <span class="sig-index">SIGNAL ${num}</span>
              <p class="sig-text">${escapeHtml(indicator)}</p>
            </div>
          `;
        })
        .join("");
    }
  }
}

// ── TAB 2: TEXT AUTHENTICITY (AI-GEN) ───────────────────────────────────────

function renderTab2AiAuth(verdict) {
  const fa = appState.currentAnalysis?.full_analysis || {};
  const ai = fa.ai_authenticity || appState.currentAnalysis?.ai_authenticity || {};
  const hasMessages = hasScrapedMessages();

  const aiProb = Math.round((ai.ai_probability ?? verdict.scores.aigen ?? 0) * 100);
  const isAi = hasMessages && (ai.is_ai_generated || aiProb > 50);

  // Reasoning narrative
  dom.t2ReasoningParagraph.textContent =
    ai.reasoning ||
    (hasMessages
      ? "Natural phrasing and human conversational variances observed."
      : "There is no input text available to evaluate.");

  // Verdict Summary Header
  if (dom.t2VerdictSummary) {
    if (!hasMessages) {
      dom.t2VerdictSummary.textContent =
        "Zero messages sampled. Linguistic syntax evaluation requires post or comment text.";
    } else if (isAi) {
      dom.t2VerdictSummary.textContent = `Structural syntax indicates Large Language Model generation (${aiProb}% synthetic likelihood).`;
    } else {
      dom.t2VerdictSummary.textContent = `Structural syntax demonstrates authentic human tone, colloquial phrasing, and emotional cadence (${100 - aiProb}% human probability).`;
    }
  }

  // Status Indicator
  if (!hasMessages) {
    dom.t2AiStatusName.textContent = "INSUFFICIENT TEXT DATA";
    dom.t2AiStatusIndicator.style.color = "var(--text-muted)";
  } else {
    dom.t2AiStatusName.textContent = isAi
      ? "SYNTHETIC MARKERS DETECTED"
      : "ORGANIC HUMAN WRITING";
    dom.t2AiStatusIndicator.style.color = isAi ? "var(--risk-bot)" : "var(--risk-human)";
  }

  // Gauge Donut Chart
  if (activeCharts.t2Gauge) activeCharts.t2Gauge.destroy();
  if (dom.chartT2Gauge) {
    const ctx = dom.chartT2Gauge.getContext("2d");

    let gaugeLabels = [];
    let gaugeData = [];
    let gaugeColors = [];

    if (!hasMessages) {
      gaugeLabels = ["No Text Sampled"];
      gaugeData = [100];
      gaugeColors = ["#334155"];
    } else {
      gaugeLabels = ["Human Likelihood", "Synthetic AI Likelihood"];
      gaugeData = [Math.max(0, 100 - aiProb), aiProb];
      gaugeColors = [isAi ? "#334155" : "#10B981", isAi ? "#EF4444" : "#334155"];
    }

    activeCharts.t2Gauge = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: gaugeLabels,
        datasets: [
          {
            data: gaugeData,
            backgroundColor: gaugeColors,
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
            labels: { boxWidth: 10, font: { size: 12 }, color: "#94A3B8" },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (!hasMessages) return " Zero posts available to evaluate";
                return ` ${context.label}: ${context.parsed}%`;
              },
            },
          },
        },
        cutout: "70%",
      },
    });
  }

  // Hallmarks Checklist (Card 2)
  if (dom.t2HallmarksList) {
    if (!hasMessages) {
      dom.t2HallmarksList.innerHTML = `
        <div class="hm-empty-notice">
          <span class="hm-empty-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </span>
          <div class="hm-empty-text">
            <strong>Hallmarks Evaluation Disabled</strong>
            <p>No posts or comments were available in this account's public timeline to evaluate for LLM generation hallmarks.</p>
          </div>
        </div>
      `;
    } else if (isAi) {
      dom.t2HallmarksList.innerHTML = `
        <div class="hm-item hm-item--flagged">
          <span class="hm-icon flagged">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </span>
          <div class="hm-text">
            <strong>Formulaic Paragraph Architecture</strong>
            <small>Rigid symmetry, uniform sentence length, and structured explanatory tone</small>
          </div>
        </div>
        <div class="hm-item hm-item--flagged">
          <span class="hm-icon flagged">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </span>
          <div class="hm-text">
            <strong>Synthetic Transitional Fillers</strong>
            <small>Repetitive use of formal bridges and neutral balanced summaries</small>
          </div>
        </div>
        <div class="hm-item hm-item--flagged">
          <span class="hm-icon flagged">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </span>
          <div class="hm-text">
            <strong>Absence of Genuine Human Voice</strong>
            <small>Lacks personal anecdotes, typos, colloquialisms, or spontaneous emotion</small>
          </div>
        </div>
      `;
    } else {
      dom.t2HallmarksList.innerHTML = `
        <div class="hm-item">
          <span class="hm-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div class="hm-text">
            <strong>Organic Conversational Phrasing</strong>
            <small>Natural informal syntax, colloquial expressions, and authentic typos</small>
          </div>
        </div>
        <div class="hm-item">
          <span class="hm-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div class="hm-text">
            <strong>Absence of Rigid Transitional Phrases</strong>
            <small>Free of robotic bridges ("Furthermore", "In conclusion", "It is important to note")</small>
          </div>
        </div>
        <div class="hm-item">
          <span class="hm-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div class="hm-text">
            <strong>Contextual Nuance &amp; Idiosyncrasy</strong>
            <small>Subjective personal anecdotes, idiosyncratic opinions, and varied emotional cadence</small>
          </div>
        </div>
      `;
    }
  }
}

// ── TAB 3: POSTING CADENCE (FREQUENCY) ──────────────────────────────────────

function renderTab3Cadence(verdict) {
  const fa = appState.currentAnalysis?.full_analysis || {};
  const freqData = fa.frequency || appState.currentAnalysis?.frequency || {};
  const cadenceFeatures = appState.currentFormattedData?.cadence_features || {};
  const rhythmFeatures = appState.currentFormattedData?.rhythm_features || {};

  // Extract raw timestamps
  const rawTimes =
    appState.currentFormattedData?.full_timestamp_timeline ||
    appState.currentRawData?.full_timestamp_timeline ||
    (appState.currentRawData?.timeline || []).map((t) => t.timestamp).filter(Boolean);

  let totalPosts = 0;
  let spanDays = 0;
  let uniqueDays = 0;

  if (rawTimes && rawTimes.length > 0) {
    totalPosts = rawTimes.length;
    const sorted = [...rawTimes].sort((a, b) => a - b);
    spanDays = Math.max(1, (sorted[sorted.length - 1] - sorted[0]) / 86400);
    const daySet = new Set(sorted.map((t) => new Date(t * 1000).toISOString().slice(0, 10)));
    uniqueDays = Math.max(1, daySet.size);
  } else if (rhythmFeatures.total_posts > 0) {
    totalPosts = rhythmFeatures.total_posts;
  }

  // Multi-factor features
  const postsPerDay = uniqueDays > 0 ? (totalPosts / uniqueDays) : 0;
  const burstRatio = cadenceFeatures.burst_ratio ?? 0;
  const quietWindow = cadenceFeatures.quiet_window_hours ?? 0;
  const commentRatio = cadenceFeatures.comment_ratio ?? 0.5;

  // Normalize bot probability (0 - 100%)
  let cadenceBotProb = 0;
  if (typeof freqData.bot_probability === "number") {
    cadenceBotProb = freqData.bot_probability <= 1.0
      ? freqData.bot_probability * 100
      : freqData.bot_probability;
  }

  // 1. Update Left Card: Timeline Ribbon Stats
  if (dom.t3TotalPosts) dom.t3TotalPosts.textContent = totalPosts;
  if (dom.t3TimelineTimespan) {
    if (totalPosts === 0) {
      dom.t3TimelineTimespan.textContent = "0 days";
    } else {
      dom.t3TimelineTimespan.textContent = spanDays < 30
        ? `${Math.round(spanDays)} days`
        : `${(spanDays / 30.4).toFixed(1)} mos`;
    }
  }
  if (dom.t3TimelineActiveDays) dom.t3TimelineActiveDays.textContent = `${uniqueDays} days`;
  if (dom.t3FrequencyNum) dom.t3FrequencyNum.textContent = `${postsPerDay.toFixed(1)}/day`;

  // 2. Update Right Card: Hero Model Verdict
  if (dom.t3ModelProb) dom.t3ModelProb.textContent = `${cadenceBotProb.toFixed(1)}%`;

  const prediction = freqData.prediction ? freqData.prediction.toUpperCase() : "HUMAN";
  const isBot = cadenceBotProb > 65 || prediction === "BOT";
  const isUncertain = cadenceBotProb >= 35 && cadenceBotProb <= 65;

  if (dom.t3CadenceVerdict) {
    if (totalPosts === 0) {
      dom.t3CadenceVerdict.textContent = "NO DATA";
      dom.t3CadenceVerdict.style.color = "var(--text-muted)";
      dom.t3CadenceVerdict.style.background = "rgba(255, 255, 255, 0.05)";
      dom.t3CadenceVerdict.style.borderColor = "var(--card-border)";
    } else {
      dom.t3CadenceVerdict.textContent = prediction;
      if (isBot) {
        dom.t3CadenceVerdict.style.color = "#EF4444";
        dom.t3CadenceVerdict.style.background = "rgba(239, 68, 68, 0.15)";
        dom.t3CadenceVerdict.style.borderColor = "rgba(239, 68, 68, 0.4)";
      } else if (isUncertain) {
        dom.t3CadenceVerdict.style.color = "#F59E0B";
        dom.t3CadenceVerdict.style.background = "rgba(245, 158, 11, 0.15)";
        dom.t3CadenceVerdict.style.borderColor = "rgba(245, 158, 11, 0.4)";
      } else {
        dom.t3CadenceVerdict.style.color = "#10B981";
        dom.t3CadenceVerdict.style.background = "rgba(16, 185, 129, 0.15)";
        dom.t3CadenceVerdict.style.borderColor = "rgba(16, 185, 129, 0.4)";
      }
    }
  }

  // 3. Update Multi-Feature Meters (Unbiased Data Representation)
  const burstPct = burstRatio * 100;
  if (dom.t3FeatBurst) dom.t3FeatBurst.textContent = `${burstPct.toFixed(1)}%`;
  if (dom.t3BarBurst) dom.t3BarBurst.style.width = `${Math.min(100, Math.max(4, burstPct))}%`;

  if (dom.t3FeatQuiet) dom.t3FeatQuiet.textContent = `${Number(quietWindow).toFixed(1)} hrs`;
  if (dom.t3BarQuiet) dom.t3BarQuiet.style.width = `${Math.min(100, Math.max(4, (quietWindow / 24) * 100))}%`;

  if (dom.t3FeatDensity) dom.t3FeatDensity.textContent = `${postsPerDay.toFixed(1)} posts/day`;
  if (dom.t3BarDensity) dom.t3BarDensity.style.width = `${Math.min(100, Math.max(4, (postsPerDay / 15) * 100))}%`;

  const commPct = commentRatio * 100;
  if (dom.t3FeatComment) dom.t3FeatComment.textContent = `${commPct.toFixed(0)}% comments`;
  if (dom.t3BarComment) dom.t3BarComment.style.width = `${Math.min(100, Math.max(4, commPct))}%`;

  if (dom.t3VerdictSummary && freqData.status) {
    dom.t3VerdictSummary.textContent = freqData.status;
  }

  // 4. Render Wide Responsive Activity Over Time Chart
  if (activeCharts.t3Timeline) activeCharts.t3Timeline.destroy();
  if (dom.chartT3Timeline) {
    const ctx = dom.chartT3Timeline.getContext("2d");

    let bucketLabels = [];
    let bucketCounts = [];

    if (rawTimes && rawTimes.length > 0) {
      const sorted = [...rawTimes].sort((a, b) => a - b);
      const minTs = sorted[0];
      const maxTs = sorted[sorted.length - 1];

      let bucketSec;
      if (spanDays <= 14) {
        bucketSec = 86400;          // daily
      } else if (spanDays <= 90) {
        bucketSec = 7 * 86400;      // weekly
      } else {
        bucketSec = 14 * 86400;     // bi-weekly
      }

      const bucketCount = Math.max(1, Math.ceil((maxTs - minTs) / bucketSec));
      const capped = Math.min(bucketCount, 24);
      const effectiveBucketSec = (maxTs - minTs) / capped;

      bucketCounts = new Array(capped).fill(0);
      bucketLabels = [];

      for (let i = 0; i < capped; i++) {
        const bucketStart = minTs + i * effectiveBucketSec;
        const d = new Date(bucketStart * 1000);
        const mo = d.toLocaleString("default", { month: "short" });
        bucketLabels.push(`${mo} ${d.getUTCDate()}`);
      }

      sorted.forEach((ts) => {
        const idx = Math.min(capped - 1, Math.floor((ts - minTs) / effectiveBucketSec));
        bucketCounts[idx]++;
      });
    } else {
      bucketLabels = ["No Scraped Activity"];
      bucketCounts = [0];
    }

    const colors = getPlatformColors();

    activeCharts.t3Timeline = new Chart(ctx, {
      type: "line",
      data: {
        labels: bucketLabels,
        datasets: [
          {
            label: "Actions (Posts & Comments)",
            data: bucketCounts,
            borderColor: totalPosts > 0 ? colors.primary : "rgba(255, 255, 255, 0.2)",
            backgroundColor: totalPosts > 0 ? colors.primaryAlpha : "rgba(255, 255, 255, 0.02)",
            fill: true,
            tension: 0.35,
            pointRadius: totalPosts > 0 ? 4 : 0,
            pointHoverRadius: totalPosts > 0 ? 6 : 0,
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
              font: { size: 11 },
              maxRotation: 40,
              autoSkip: true,
              maxTicksLimit: 12,
            },
            title: {
              display: true,
              text: "Timeline (UTC)",
              font: { size: 11 },
            },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: { font: { size: 11 }, precision: 0 },
            title: {
              display: true,
              text: "Actions Count",
              font: { size: 11 },
            },
            beginAtZero: true,
            suggestedMax: totalPosts > 0 ? undefined : 5,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: totalPosts > 0,
            callbacks: {
              title: (items) => `Period starting ${items[0].label}`,
              label: (item) => ` ${item.raw} post${item.raw !== 1 ? "s" : ""} / comment${item.raw !== 1 ? "s" : ""}`,
            },
          },
        },
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
  if (medianSec >= 86400) {
    dom.t4MedianGapVal.textContent = `${(medianSec / 86400).toFixed(1)} days (${(medianSec / 3600).toFixed(0)} hrs)`;
  } else if (medianSec >= 3600) {
    dom.t4MedianGapVal.textContent = `${(medianSec / 3600).toFixed(1)} hrs`;
  } else {
    dom.t4MedianGapVal.textContent = `${Math.round(medianSec / 60)} mins`;
  }

  // ── Resolve timestamps and build parsed date records ──
  const rawTimes =
    appState.currentFormattedData?.full_timestamp_timeline ||
    appState.currentRawData?.full_timestamp_timeline ||
    (appState.currentRawData?.timeline || []).map((t) => t.timestamp).filter(Boolean);

  const parsedEntries = rawTimes.map((ts) => {
    const d = new Date(ts * 1000);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    const dayShort = d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dateStr = d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return {
      ts,
      d,
      monthKey,
      monthName,
      dayShort,
      dateStr,
      weekday: (d.getUTCDay() + 6) % 7, // Mon=0..Sun=6
      hour: d.getUTCHours(),
    };
  });

  // Populate observed lifespan info banner
  if (parsedEntries.length > 0) {
    const sorted = [...parsedEntries].sort((a, b) => a.ts - b.ts);
    const firstD = sorted[0].d;
    const lastD = sorted[sorted.length - 1].d;
    const firstStr = firstD.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    const lastStr = lastD.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    const uniqueDates = new Set(sorted.map((e) => e.dateStr));
    if (dom.t4ObservedSpan) dom.t4ObservedSpan.textContent = `${firstStr} – ${lastStr}`;
    if (dom.t4ObservedDaysBadge) dom.t4ObservedDaysBadge.textContent = `${uniqueDates.size} active days (${rawTimes.length} total actions)`;
  } else {
    if (dom.t4ObservedSpan) dom.t4ObservedSpan.textContent = "None";
    if (dom.t4ObservedDaysBadge) dom.t4ObservedDaysBadge.textContent = "0 active days (0 actions)";
  }

  // Populate Month Filter Dropdown
  if (dom.t4MonthFilter) {
    if (parsedEntries.length === 0) {
      dom.t4MonthFilter.innerHTML = `<option value="ALL">No Activity Recorded</option>`;
    } else {
      const monthCounts = {};
      parsedEntries.forEach((e) => {
        if (!monthCounts[e.monthKey]) monthCounts[e.monthKey] = { name: e.monthName, count: 0 };
        monthCounts[e.monthKey].count++;
      });

      const currentVal = dom.t4MonthFilter.value || "ALL";
      dom.t4MonthFilter.innerHTML = `<option value="ALL">All Time (${parsedEntries.length} total actions)</option>`;

      const sortedMonths = Object.keys(monthCounts).sort().reverse();
      sortedMonths.forEach((mKey) => {
        const m = monthCounts[mKey];
        const opt = document.createElement("option");
        opt.value = mKey;
        opt.textContent = `${m.name} (${m.count} action${m.count !== 1 ? "s" : ""})`;
        dom.t4MonthFilter.appendChild(opt);
      });

      if (currentVal && dom.t4MonthFilter.querySelector(`option[value="${currentVal}"]`)) {
        dom.t4MonthFilter.value = currentVal;
      }
    }

    dom.t4MonthFilter.onchange = () => {
      renderTab4Rhythm(verdict);
    };
  }

  // Filter entries if a specific month is selected
  const selectedMonth = dom.t4MonthFilter ? dom.t4MonthFilter.value : "ALL";
  const activeEntries = (selectedMonth && selectedMonth !== "ALL")
    ? parsedEntries.filter((e) => e.monthKey === selectedMonth)
    : parsedEntries;

  // 1. 24-Hour Circadian Bar Chart (UTC)
  if (activeCharts.t4Circadian) activeCharts.t4Circadian.destroy();
  if (dom.chartT4Circadian) {
    const ctx = dom.chartT4Circadian.getContext("2d");
    const hourCounts = new Array(24).fill(0);
    const hourDatesMap = Array.from({ length: 24 }, () => ({}));

    if (activeEntries.length > 0) {
      activeEntries.forEach((e) => {
        hourCounts[e.hour]++;
        hourDatesMap[e.hour][e.dayShort] = (hourDatesMap[e.hour][e.dayShort] || 0) + 1;
      });
    }

    const colors = getPlatformColors();
    const barColors = hourCounts.map((_, i) => {
      if (i >= 0 && i < 6) return "rgba(148, 163, 184, 0.4)"; // night — dim
      return colors.primary;
    });

    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    activeCharts.t4Circadian = new Chart(ctx, {
      type: "bar",
      data: {
        labels: hourLabels,
        datasets: [
          {
            data: hourCounts,
            backgroundColor: barColors,
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
              font: { size: 10 },
              maxRotation: 0,
              callback: (v, idx) => (idx % 3 === 0 ? `${idx}h` : ""),
            },
            title: {
              display: true,
              text: "Hour of Day (UTC)",
              font: { size: 11 },
            },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: { font: { size: 11 }, precision: 0 },
            title: {
              display: true,
              text: "Actions Count",
              font: { size: 11 },
            },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Hour ${items[0].label} UTC`,
              label: (item) => ` ${item.raw} action${item.raw !== 1 ? "s" : ""}`,
              afterLabel: (item) => {
                const h = parseInt(item.label);
                const dateMap = hourDatesMap[h] || {};
                const dateEntries = Object.entries(dateMap);
                if (dateEntries.length === 0) return "";
                const dateList = dateEntries
                  .map(([dStr, cnt]) => `${dStr} (${cnt})`)
                  .slice(0, 4)
                  .join(", ");
                return `Dates: ${dateList}${dateEntries.length > 4 ? "..." : ""}`;
              },
            },
          },
        },
      },
    });
  }

  // 2. Day x Hour Heatmap Matrix Render
  if (dom.t4HeatmapMatrix) {
    dom.t4HeatmapMatrix.innerHTML = "";
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const blockLabels = [
      "Night (00:00 - 06:00 UTC)",
      "Morning (06:00 - 12:00 UTC)",
      "Afternoon (12:00 - 18:00 UTC)",
      "Evening (18:00 - 24:00 UTC)",
    ];

    const matrix = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    const cellDatesMap = Array.from({ length: 7 }, () => [{}, {}, {}, {}]);

    if (activeEntries.length > 0) {
      activeEntries.forEach((e) => {
        const block = Math.min(3, Math.floor(e.hour / 6));
        matrix[e.weekday][block]++;
        cellDatesMap[e.weekday][block][e.dayShort] = (cellDatesMap[e.weekday][block][e.dayShort] || 0) + 1;
      });
    }

    let maxCount = 0;
    for (let di = 0; di < 7; di++) {
      for (let b = 0; b < 4; b++) {
        if (matrix[di][b] > maxCount) maxCount = matrix[di][b];
      }
    }

    days.forEach((day, di) => {
      const col = document.createElement("div");
      col.className = "hm-day-col";
      col.innerHTML = `<span class="hm-day-title">${day}</span>`;
      for (let b = 0; b < 4; b++) {
        const cell = document.createElement("div");
        const count = matrix[di][b];
        let lvl = 0;
        if (count > 0) {
          if (maxCount <= 3) {
            lvl = count;
          } else {
            const ratio = count / maxCount;
            lvl = ratio < 0.35 ? 1 : ratio < 0.7 ? 2 : 3;
          }
        }
        cell.className = `hm-cell ${lvl > 0 ? `level-${lvl}` : "level-0"}`;

        const dMap = cellDatesMap[di][b] || {};
        const dEntries = Object.entries(dMap);
        const dateSummary = dEntries.length > 0
          ? "\nActive Dates: " + dEntries.map(([dStr, cnt]) => `${dStr} (${cnt})`).slice(0, 5).join(", ")
          : "";

        cell.title = `${day} · ${blockLabels[b]}: ${count} action${count === 1 ? "" : "s"}${dateSummary}`;
        col.appendChild(cell);
      }
      dom.t4HeatmapMatrix.appendChild(col);
    });
  }
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
      if (typeof cleanup === "function") cleanup();
      logToTerminal("Scraper finished successfully.", "ok");
      updateStepper("scraping", "done");
      finishScrape(true, target);
    } else if (ev.event === "error") {
      if (typeof cleanup === "function") cleanup();
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

    // Update the URL silently to prevent a race condition with the hash router
    window.history.replaceState(null, "", `#/${appState.currentPlatform}?user=${targetUser}&tab=${appState.currentTab}`);

    // Force the profile to load and BYPASS the local JSON cache
    await loadUserProfile(targetUser, true);
  } else {
    // If the scrape failed, hide the telemetry bar after a delay
    setTimeout(() => {
      dom.telemetryBar.classList.add("hidden");
    }, 2000);
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

  // Synchronize 2x2 overview stat cards active state
  document.querySelectorAll(".stat-quadrant-card").forEach((card) => {
    const isTarget = card.getAttribute("data-tab-link") === tabId;
    card.classList.toggle("active", isTarget);
    card.setAttribute("aria-selected", isTarget ? "true" : "false");
    const pill = card.querySelector(".sq-action-pill");
    if (pill) pill.textContent = isTarget ? "Active" : "Inspect →";
  });

  if (dom.paramPanels) {
    dom.paramPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-panel-${tabId}`);
    });
  }

  // Ensure active panel charts are rendered with proper dimensions once visible
  if (appState.currentAnalysis) {
    const verdict = computeWeightedVerdict(appState.currentAnalysis);
    if (tabId === "param1") renderTab1Semantic(verdict);
    else if (tabId === "param2") renderTab2AiAuth(verdict);
    else if (tabId === "param3") renderTab3Cadence(verdict);
    else if (tabId === "param4") renderTab4Rhythm(verdict);
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
    if (target) {
      activateTab(target, true);
      const panelTarget = document.getElementById("tab-panel-" + target);
      if (panelTarget) {
        panelTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const target = card.getAttribute("data-tab-link");
      if (target) {
        activateTab(target, true);
        const panelTarget = document.getElementById("tab-panel-" + target);
        if (panelTarget) {
          panelTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
  });
});

// Guided step navigation buttons between parameter tabs
document.querySelectorAll(".btn-step-nav").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const target = btn.getAttribute("data-nav-target");
    if (target) {
      activateTab(target, true);
      const panelTarget = document.getElementById("tab-panel-" + target);
      if (panelTarget) {
        panelTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
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
  } catch (err) { }

  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);

  await reloadUsersList("all");
  await handleRoute();
})();