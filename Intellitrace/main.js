const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ── helpers ──────────────────────────────────────────────────────────────────

function getResourcePath(...segments) {
  // In production (packaged), resources live next to the exe.
  // In dev, they live next to main.js.
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : __dirname;
  return path.join(base, ...segments);
}

// ── window ───────────────────────────────────────────────────────────────────

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 720,
    minHeight: 560,
    frame: false,          // custom title-bar
    backgroundColor: "#0a0b0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
  // win.webContents.openDevTools();   // uncomment during development
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC: window controls ─────────────────────────────────────────────────────

ipcMain.on("window-minimize", () => win?.minimize());
ipcMain.on("window-maximize", () =>
  win?.isMaximized() ? win.unmaximize() : win.maximize()
);
ipcMain.on("window-close", () => win?.close());

// ── Global Storage Path ──────────────────────────────────────────────────────
// This points to the safe, writable AppData folder on Windows
const userStorageDir = app.getPath("userData");

// ── IPC: run scraper exe ─────────────────────────────────────────────────────
// Sends back events:  { event: "stdout"|"stderr"|"done"|"error", data }

ipcMain.on("run-scraper", (event, { username }) => {
  const exePath = getResourcePath("Scrapingtool.exe");

  if (!fs.existsSync(exePath)) {
    event.sender.send("scraper-event", {
      event: "error",
      data: `Scrapingtool.exe not found at:\n${exePath}`,
    });
    return;
  }

  // Set the CWD to userStorageDir so it has permission to save the JSON file
  const proc = spawn(exePath, [username], {
    cwd: userStorageDir,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" } // <-- Added this to prevent the Windows emoji crash!
  });

  proc.stdout.on("data", (buf) => {
    event.sender.send("scraper-event", {
      event: "stdout",
      data: buf.toString(),
    });
  });

  proc.stderr.on("data", (buf) => {
    event.sender.send("scraper-event", {
      event: "stderr",
      data: buf.toString(),
    });
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
    event.sender.send("scraper-event", {
      event: "error",
      data: err.message,
    });
  });
});

// ── IPC: read scraped JSON ────────────────────────────────────────────────────

ipcMain.handle("read-json", (_event, { username }) => {
  // Read from the same userStorageDir where the scraper just saved it
  const filePath = path.join(userStorageDir, "UserData", `formatted_${username}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
});

// ── IPC: save settings ────────────────────────────────────────────────────────

const SETTINGS_PATH = path.join(userStorageDir, "settings.json");

ipcMain.handle("load-settings", () => {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    // Fallback defaults if they haven't saved settings yet
    return { apiUrl: "http://127.0.0.1:8000", apiKey: "" };
  }
});

ipcMain.handle("save-settings", (_event, settings) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
});