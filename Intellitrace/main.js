const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Automatically detects where the scraper binary is located.
 * Checks the local project directory first (for development or Linux system-electron),
 * then falls back to process.resourcesPath (for packaged production builds).
 */
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
    frame: false,          // custom title-bar
    backgroundColor: "#0c0e14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
  // win.webContents.openDevTools(); // Uncomment for debugging during demo
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

// ── GLOBAL STORAGE PATH ──────────────────────────────────────────────────────
// Windows: %APPDATA%/reddit-bot-detector/
// Linux:   ~/.config/reddit-bot-detector/
const userStorageDir = app.getPath("userData");

// ── IPC: RUN SCRAPER EXE ─────────────────────────────────────────────────────

ipcMain.on("run-scraper", (event, { username }) => {
  // Use .exe on Windows, extensionless binary on Linux/macOS
  const execName = process.platform === "win32" ? "Scrapingtool.exe" : "Scrapingtool";

  // CHANGED: Pass BOTH the folder name ("Scrapingtool") AND the executable name
  // This resolves to -> Intellitrace/Scrapingtool/Scrapingtool
  const exePath = getResourcePath("Scrapingtool", execName);

  // Safety check to ensure the scraper exists
  if (!fs.existsSync(exePath)) {
    event.sender.send("scraper-event", {
      event: "error",
      data: `${execName} not found at:\n${exePath}`,
    });
    return;
  }

  // Spawn the process
  const proc = spawn(exePath, [username], {
    cwd: userStorageDir, // Run inside userData directory so it can save JSON without permission errors
    env: { ...process.env, PYTHONIOENCODING: "utf-8" } // Force UTF-8 to handle emojis
  });

  proc.stdout.on("data", (buf) => {
    event.sender.send("scraper-event", { event: "stdout", data: buf.toString() });
  });

  proc.stderr.on("data", (buf) => {
    event.sender.send("scraper-event", { event: "stderr", data: buf.toString() });
  });

  proc.on("close", (code) => {
    if (code === 0) {
      event.sender.send("scraper-event", { event: "done", data: code });
    } else {
      event.sender.send("scraper-event", {
        event: "error",
        data: `Process exited with code ${code}`,
      });
    }
  });

  proc.on("error", (err) => {
    event.sender.send("scraper-event", { event: "error", data: err.message });
  });
});

// ── IPC: READ SCRAPED JSON ───────────────────────────────────────────────────

ipcMain.handle("read-json", (_event, { username }) => {
  // Look for the JSON exactly where the scraper saved it
  const filePath = path.join(userStorageDir, "UserData", `formatted_${username}.json`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }
  
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
});

// ── IPC: SETTINGS MANAGEMENT ─────────────────────────────────────────────────

const SETTINGS_PATH = path.join(userStorageDir, "settings.json");

ipcMain.handle("load-settings", () => {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    // Default values for the demo
    return { 
      apiUrl: "https://cel-est-ial-34929-botdetectionbackend.hf.space", 
      apiKey: "" 
    };
  }
});

ipcMain.handle("save-settings", (_event, settings) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
});