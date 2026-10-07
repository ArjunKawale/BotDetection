const { contextBridge, ipcRenderer } = require("electron");

const api = {
  // Window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close:    () => ipcRenderer.send("window-close"),

  // Reddit authentication
  redditLogin: () => ipcRenderer.invoke("reddit-login"),

  // Scraper runner & events
  runScraper: (username) => ipcRenderer.send("run-scraper", { username }),
  onScraperEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("scraper-event", handler);
    return () => ipcRenderer.removeListener("scraper-event", handler);
  },

  // User management & Disk data loading
  listUsers: (platform) => ipcRenderer.invoke("list-users", { platform }),
  getUser: (platform, username) => ipcRenderer.invoke("get-user", { platform, username }),
  saveAnalysis: (username, analysis) => ipcRenderer.invoke("save-analysis", { username, analysis }),
  onUsersUpdated: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("users-updated", handler);
    return () => ipcRenderer.removeListener("users-updated", handler);
  },

  // Legacy single file reading
  readJson: (username) => ipcRenderer.invoke("read-json", { username }),

  // Settings
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (s)  => ipcRenderer.invoke("save-settings", s),
};

// Expose both window.api and window.electronAPI for maximum compatibility
contextBridge.exposeInMainWorld("api", api);
contextBridge.exposeInMainWorld("electronAPI", api);