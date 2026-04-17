const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  minimize:  () => ipcRenderer.send("window-minimize"),
  maximize:  () => ipcRenderer.send("window-maximize"),
  close:     () => ipcRenderer.send("window-close"),

  // Scraper
  runScraper: (username) =>
    ipcRenderer.send("run-scraper", { username }),
  onScraperEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("scraper-event", handler);
    return () => ipcRenderer.removeListener("scraper-event", handler);
  },

  // File reading
  readJson: (username) =>
    ipcRenderer.invoke("read-json", { username }),

  // Settings
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (s)  => ipcRenderer.invoke("save-settings", s),
});
