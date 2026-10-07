const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ── GLOBAL STORAGE PATHS ─────────────────────────────────────────────────────
const userStorageDir = app.getPath("userData");
const systemUserDataDir = path.join(userStorageDir, "UserData");
const localUserDataDir = path.join(__dirname, "UserData");

// Ensure directories exist
try {
  if (!fs.existsSync(systemUserDataDir)) fs.mkdirSync(systemUserDataDir, { recursive: true });
} catch (e) {}
try {
  if (!fs.existsSync(localUserDataDir)) fs.mkdirSync(localUserDataDir, { recursive: true });
} catch (e) {}

function getUserDataDirs() {
  const dirs = [];
  if (fs.existsSync(localUserDataDir)) dirs.push(localUserDataDir);
  if (fs.existsSync(systemUserDataDir) && systemUserDataDir !== localUserDataDir) dirs.push(systemUserDataDir);
  return dirs;
}

function getPrimaryUserDataDir() {
  return fs.existsSync(localUserDataDir) ? localUserDataDir : systemUserDataDir;
}

console.log("\n=======================================================");
console.log(`[SYSTEM] Storage directories:`, getUserDataDirs());
console.log("=======================================================\n");

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getResourcePath(...segments) {
  const devPath = path.join(__dirname, ...segments);
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return path.join(process.resourcesPath, ...segments);
}

// ── WINDOW MANAGEMENT ────────────────────────────────────────────────────────

let win;
let watcher = null;
let watchDebounce = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 680,
    frame: false,
    backgroundColor: "#0d0f17",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");

  // Setup file watcher on UserData directory
  setupFileWatcher();
}

const watchers = [];

function setupFileWatcher() {
  watchers.forEach(w => { try { w.close(); } catch (e) {} });
  watchers.length = 0;

  getUserDataDirs().forEach(dir => {
    try {
      const w = fs.watch(dir, (eventType, filename) => {
        if (watchDebounce) clearTimeout(watchDebounce);
        watchDebounce = setTimeout(() => {
          if (win && !win.isDestroyed()) {
            console.log(`[WATCHER] Detected file change in ${dir} (${filename || eventType}), notifying renderer...`);
            win.webContents.send("users-updated");
          }
        }, 300);
      });
      watchers.push(w);
      console.log(`[WATCHER] Active on: ${dir}`);
    } catch (err) {
      console.warn(`[WATCHER] Could not setup file watcher on ${dir}: ${err.message}`);
    }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  watchers.forEach(w => { try { w.close(); } catch (e) {} });
  watchers.length = 0;
  if (process.platform !== "darwin") app.quit();
});

// ── IPC: WINDOW CONTROLS ─────────────────────────────────────────────────────

ipcMain.on("window-minimize", () => win?.minimize());
ipcMain.on("window-maximize", () =>
  win?.isMaximized() ? win.unmaximize() : win.maximize()
);
ipcMain.on("window-close", () => win?.close());

// ── IPC: REDDIT AUTHENTICATION ───────────────────────────────────────────────

ipcMain.handle("reddit-login", async () => {
  console.log("[AUTH] Opening Reddit login window...");

  return new Promise((resolve) => {
    let isResolved = false;
    const authWin = new BrowserWindow({
      width: 500,
      height: 700,
      autoHideMenuBar: true,
      title: "Reddit Authentication"
    });

    authWin.loadURL("https://www.reddit.com/login");

    const checkInterval = setInterval(async () => {
      if (authWin.isDestroyed()) return;

      const cookies = await authWin.webContents.session.cookies.get({});
      const hasSession = cookies.some((c) => c.name === "reddit_session");

      if (hasSession && !isResolved) {
        console.log("[AUTH] Session cookie detected. Extracting credentials...");
        isResolved = true;
        clearInterval(checkInterval);

        const pwCookies = cookies.map((c) => {
          let ss = "Lax";
          if (c.sameSite === "no_restriction" || c.sameSite === "None") {
            ss = "None";
          } else if (c.sameSite === "strict" || c.sameSite === "Strict") {
            ss = "Strict";
          }

          return {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            expires: c.expirationDate || (Date.now() / 1000) + (86400 * 30),
            httpOnly: c.httpOnly || false,
            secure: c.secure || false,
            sameSite: ss,
          };
        });

        const statePath = path.join(userStorageDir, "reddit_state.json");
        fs.writeFileSync(statePath, JSON.stringify({ cookies: pwCookies, origins: [] }, null, 2));

        console.log(`[AUTH] Success! State saved to: ${statePath}`);

        authWin.close();
        resolve(true);
      }
    }, 1000);

    authWin.on("closed", () => {
      clearInterval(checkInterval);
      if (!isResolved) {
        console.log("[AUTH] Window closed by user without logging in.");
        isResolved = true;
        resolve(false);
      }
    });
  });
});

// ── IPC: RUN SCRAPER EXE ─────────────────────────────────────────────────────

ipcMain.on("run-scraper", (event, { username }) => {
  const execName = process.platform === "win32" ? "Scrapingtool.exe" : "Scrapingtool";
  const exePath = getResourcePath("Scrapingtool", execName);

  console.log(`\n[SCRAPER] Launching for target: ${username}`);
  console.log(`[SCRAPER] Executable path: ${exePath}`);
  console.log(`[SCRAPER] Working directory: ${userStorageDir}`);

  if (!fs.existsSync(exePath)) {
    console.error(`[SCRAPER ERROR] Executable NOT FOUND at ${exePath}`);
    event.sender.send("scraper-event", {
      event: "error",
      data: `${execName} not found at:\n${exePath}`,
    });
    return;
  }

  const proc = spawn(exePath, [username], {
    cwd: userStorageDir,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });

  proc.stdout.on("data", (buf) => {
    const msg = buf.toString().trim();
    if (msg) console.log(`[PY-OUT] ${msg}`);
    event.sender.send("scraper-event", { event: "stdout", data: msg });
  });

  proc.stderr.on("data", (buf) => {
    const msg = buf.toString().trim();
    if (msg) console.error(`[PY-ERR] ${msg}`);
    event.sender.send("scraper-event", { event: "stderr", data: msg });
  });

  proc.on("close", (code) => {
    console.log(`[SCRAPER] Process exited with code ${code}`);
    event.sender.send("scraper-event", { event: "done", data: code });
  });

  proc.on("error", (err) => {
    console.error(`[SCRAPER ERROR] Process failed to start: ${err.message}`);
    event.sender.send("scraper-event", { event: "error", data: err.message });
  });
});

// ── IPC: USER DATA & ANALYSIS PERSISTENCE ────────────────────────────────────

ipcMain.handle("list-users", async (_event, { platform = "all" } = {}) => {
  try {
    const dirs = getUserDataDirs();
    const usersMap = new Map();

    for (const d of dirs) {
      if (!fs.existsSync(d)) continue;
      const files = fs.readdirSync(d);

      for (const f of files) {
        let username = null;
        let isRaw = false;
        let isAnalysis = false;
        let isFormatted = false;

        if (f.startsWith("formatted_") && f.endsWith(".json")) {
          username = f.replace(/^formatted_/, "").replace(/\.json$/, "");
          isFormatted = true;
        } else if (f.startsWith("reddit_user_") && f.endsWith("_scraped.json")) {
          username = f.replace(/^reddit_user_/, "").replace(/_scraped\.json$/, "");
          isRaw = true;
        } else if (f.startsWith("bluesky_user_") && f.endsWith("_scraped.json")) {
          username = f.replace(/^bluesky_user_/, "").replace(/_scraped\.json$/, "");
          isRaw = true;
        } else if (f.startsWith("result_") && f.endsWith(".json")) {
          username = f.replace(/^result_/, "").replace(/\.json$/, "");
          isAnalysis = true;
        }

        if (!username) continue;

        const userPlat = (username.includes(".") || f.startsWith("bluesky_")) ? "bluesky" : "reddit";
        if (platform !== "all" && userPlat !== platform) continue;

        if (!usersMap.has(username)) {
          usersMap.set(username, {
            username,
            platform: userPlat,
            hasFormatted: false,
            hasRaw: false,
            hasAnalysis: false,
            totalPosts: 0,
            lastModified: 0,
            dir: d,
          });
        }

        const entry = usersMap.get(username);
        if (isFormatted) entry.hasFormatted = true;
        if (isRaw) entry.hasRaw = true;
        if (isAnalysis) entry.hasAnalysis = true;

        try {
          const stats = fs.statSync(path.join(d, f));
          if (stats.mtimeMs > entry.lastModified) {
            entry.lastModified = stats.mtimeMs;
          }
        } catch (e) {}
      }
    }

    const resultList = [];
    for (const user of usersMap.values()) {
      for (const d of dirs) {
        try {
          const fPath = path.join(d, `formatted_${user.username}.json`);
          if (fs.existsSync(fPath)) {
            const content = JSON.parse(fs.readFileSync(fPath, "utf8"));
            user.totalPosts = content?.rhythm_features?.total_posts || content?.messages?.messages?.length || 0;
            break;
          } else {
            const rawPattern = user.platform === "bluesky"
              ? `bluesky_user_${user.username}_scraped.json`
              : `reddit_user_${user.username}_scraped.json`;
            const rawPath = path.join(d, rawPattern);
            if (fs.existsSync(rawPath)) {
              const content = JSON.parse(fs.readFileSync(rawPath, "utf8"));
              user.totalPosts = content?.timeline?.length || content?.full_timestamp_timeline?.length || 0;
              break;
            }
          }
        } catch (err) {}
      }
      resultList.push(user);
    }

    resultList.sort((a, b) => b.lastModified - a.lastModified);
    return resultList;
  } catch (err) {
    console.error("[LIST USERS ERROR]", err);
    return [];
  }
});

ipcMain.handle("get-user", async (_event, { platform, username }) => {
  if (!username) throw new Error("Username required");
  const dirs = getUserDataDirs();
  const result = {
    username,
    platform: platform || (username.includes(".") ? "bluesky" : "reddit"),
    formatted: null,
    raw: null,
    analysis: null,
  };

  for (const d of dirs) {
    const formattedPath = path.join(d, `formatted_${username}.json`);
    if (!result.formatted && fs.existsSync(formattedPath)) {
      try {
        result.formatted = JSON.parse(fs.readFileSync(formattedPath, "utf8"));
      } catch (e) {}
    }

    const candidateRawFiles = [
      path.join(d, `reddit_user_${username}_scraped.json`),
      path.join(d, `bluesky_user_${username}_scraped.json`),
      path.join(d, `${username}_scraped.json`),
    ];
    for (const rawPath of candidateRawFiles) {
      if (!result.raw && fs.existsSync(rawPath)) {
        try {
          result.raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
          break;
        } catch (e) {}
      }
    }

    const analysisPath = path.join(d, `result_${username}.json`);
    if (!result.analysis && fs.existsSync(analysisPath)) {
      try {
        result.analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
      } catch (e) {}
    }
  }

  return result;
});

ipcMain.handle("save-analysis", async (_event, { username, analysis }) => {
  if (!username || !analysis) return false;
  try {
    const targetDir = getPrimaryUserDataDir();
    const analysisPath = path.join(targetDir, `result_${username}.json`);
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), "utf8");
    console.log(`[SAVE ANALYSIS] Persisted analysis for ${username} to ${analysisPath}`);
    return true;
  } catch (err) {
    console.error(`[SAVE ANALYSIS ERROR] Failed for ${username}:`, err);
    return false;
  }
});

// Legacy single-file reader
ipcMain.handle("read-json", (_event, { username }) => {
  const dirs = getUserDataDirs();
  for (const d of dirs) {
    const filePath = path.join(d, `formatted_${username}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    }
  }
  throw new Error(`JSON file not found for ${username}`);
});

// ── IPC: SETTINGS MANAGEMENT ─────────────────────────────────────────────────

const SETTINGS_PATH = path.join(userStorageDir, "settings.json");

ipcMain.handle("load-settings", () => {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {
      apiUrl: "http://localhost:8000",
      apiKey: "intellitrace_dev_key",
    };
  }
});

ipcMain.handle("save-settings", (_event, settings) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
});