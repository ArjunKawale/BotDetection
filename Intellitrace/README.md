# Reddit Bot Detector — Electron App

## Folder Structure

Place all files like this **before** running:

```
reddit-bot-detector/
├── main.js
├── preload.js
├── index.html
├── renderer.js
├── package.json
├── Scrapingtool.exe        ← your scraper executable
└── User data/              ← created by Scrapingtool.exe
    └── formatted_<username>.json
```

## Setup

```bash
npm install
npm start
```

## How It Works

1. **Enter a Reddit username** (with or without `u/` prefix) and click **Run Analysis**.
2. The app spawns `Scrapingtool.exe <username>` and streams its stdout/stderr into the log terminal.
3. Once the exe exits (code 0), it reads `User data/formatted_<username>.json`.
4. It POSTs the JSON to your FastAPI backend and streams the SSE response.
5. Each pipeline step (ideology → AI text → frequency → rhythm) lights up in the sidebar.
6. The final result card shows the verdict, probability bars, and per-model details.

## API Configuration

Click **API Settings** (bottom-left gear icon) to set:
- **API Base URL** — default: `http://localhost:8000`
- **X-API-Key** — your `API_SECURITY_KEY` from the FastAPI `.env`

Settings are saved to your OS user-data folder automatically.

## Building a Distributable

```bash
npm run build
```

This produces a Windows NSIS installer in `dist/`.  
`Scrapingtool.exe` and `User data/` are bundled automatically via `extraResources`.

## Notes

- The app uses a **frameless window** with custom title-bar controls.
- All IPC between renderer and main process is done via `contextBridge` — no `nodeIntegration`.
- SSE is consumed directly from the renderer using the browser `fetch` + `ReadableStream` API (works because FastAPI has `allow_origins: ["*"]`).
