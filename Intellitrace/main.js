const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ── GLOBAL STORAGE PATH ──────────────────────────────────────────────────────
const userStorageDir = app.getPath("userData");
console.log("\n=======================================================");
console.log(`[SYSTEM] App Data Directory: ${userStorageDir}`);
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

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    frame: false,
    backgroundColor: "#0c0e14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
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

// ── IPC: READ SCRAPED JSON ───────────────────────────────────────────────────

ipcMain.handle("read-json", (_event, { username }) => {
  const filePath = path.join(userStorageDir, "UserData", `formatted_${username}.json`);
  console.log(`[READ JSON] Attempting to load: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`[READ JSON] File not found: ${filePath}`);
    throw new Error(`JSON file not found: ${filePath}`);
  }
  
  const raw = fs.readFileSync(filePath, "utf8");
  console.log(`[READ JSON] Successfully loaded ${raw.length} bytes.`);
  return JSON.parse(raw);
});

// ── IPC: SETTINGS MANAGEMENT ─────────────────────────────────────────────────

const SETTINGS_PATH = path.join(userStorageDir, "settings.json");

ipcMain.handle("load-settings", () => {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return { 
      apiUrl: "https://cel-est-ial-34929-botdetectionbackend.hf.space", 
      apiKey: "", 
    };
  }
});

ipcMain.handle("save-settings", (_event, settings) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
});