# IntelliTrace — Electron Desktop App

> A multi-signal desktop application for analysing public Reddit and Bluesky account activity using content analysis and behavioural models.

![Electron](https://img.shields.io/badge/Electron-Desktop_App-47848F)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![XGBoost](https://img.shields.io/badge/XGBoost-ML_Model-EA7E24)
![Gemini API](https://img.shields.io/badge/Google_Gemini-Content_Analysis-4285F4)

---

## Overview

IntelliTrace provides a desktop interface for collecting public account activity, running four complementary detection signals, and reviewing an overall bot-likelihood indicator with individual signal results.

## Features

- Reddit and Bluesky account collection
- Four-signal analysis pipeline
- Live analysis progress through Server-Sent Events (SSE)
- Overall result and signal-level visualisations
- Local profile data and analysis history
- API endpoint and key configuration through the application settings

## Detection Signals

| Signal | Technology | Purpose |
|---|---|---|
| Ideology & Intent | Google Gemini API | Examines themes, repeated narratives and spam- or propaganda-like patterns. |
| AI-Text Authenticity | Google Gemini API | Estimates whether analysed text may be AI-generated. |
| Posting Cadence | XGBoost | Evaluates bursts, quiet windows and posting density. |
| Rhythmic Patterns | XGBoost | Evaluates posting intervals, timing regularity and activity rhythms. |

> These signals provide supporting evidence, not definitive proof that an account is automated. AI-generated text alone does not establish that an account is a bot.

---

## Tech Stack

**Frontend:** Electron, HTML, CSS, JavaScript, Chart.js  
**Backend:** Python, FastAPI, Uvicorn  
**Analysis:** Google Gemini API, XGBoost, Pandas, NumPy  
**Collection:** Playwright-based Reddit scraper, Bluesky AT Protocol client  
**Communication:** REST API and Server-Sent Events (SSE)

---

## Folder Structure

The relevant frontend structure is:

```text
BotDetection/
├── Backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── Scrapingtool.py
│   ├── Scrapingtool.spec
│   └── ...
│
└── Intellitrace/
    ├── main.js
    ├── preload.js
    ├── index.html
    ├── renderer.js
    ├── package.json
    ├── README.md
    ├── assets/
    ├── Scrapingtool/
    │   └── Scrapingtool.exe
    └── UserData/
```

The application also uses an OS-specific application-data directory for settings and stored account data. The scraper executable must be built for the target operating system; it is not created by `npm install`.

---

## Setup

### 1. Start the FastAPI backend

From the repository root, open a terminal:

```powershell
cd Backend
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Create `Backend/.env` and configure the required values:

```dotenv
API_SECURITY_KEY=your_local_api_secret
API=your_gemini_api_key
```

The `API_SECURITY_KEY` value must match the key configured in the app's **API Configuration** settings. `API` is used for Gemini analysis. Keep this file private and do not commit it.

Start the backend:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Keep this terminal running.

### 2. Install and start the Electron app

Open a second terminal:

```powershell
cd Intellitrace
npm install
npm start
```

In development, the Electron app runs `Backend/Scrapingtool.py` using the backend virtual environment, so a separately built scraper executable is not required. Playwright's Chromium browser must be installed with the command above. For packaged builds, place the platform-specific scraper executable in `Intellitrace/Scrapingtool/`.

---

## How It Works

1. Enter an account username and select Reddit or Bluesky.
2. The Electron main process launches the configured scraper.
3. Collected account data is formatted and prepared for analysis.
4. The frontend sends the analysis request to FastAPI using the `X-API-Key` header.
5. The backend runs the four detection signals and streams progress updates.
6. The dashboard displays the overall result and individual signal outputs.

## API Configuration

Open **API Configuration** in the application to set:

- **API Base URL** — defaults to `http://localhost:8000`
- **API Key** — must match `API_SECURITY_KEY` in `Backend/.env`

Settings are saved in the operating-system application-data directory. The default development key is for local testing only; use a strong, private key for any deployment.

## Packaging

The current `package.json` build script targets a **Linux AppImage**:

```bash
npm run build
```

This does **not** currently produce a Windows NSIS installer. Windows packaging requires a Windows build target in `package.json` and verification that the scraper and its resources are bundled correctly.

---

## Project

**IntelliTrace: Multi-Model Online Authentic Identity Detection System**  
Group ID: EXCS-TE-BE-24  
Department of Electronics & Computer Science  
Vidyalankar Institute of Technology
