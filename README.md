# Intellitrace: Reddit Bot Detector

Intellitrace is a multi-model bot detection system designed, developed, and evaluated to identify automated accounts on the Reddit app. It utilizes an Electron application frontend and a FastAPI backend to run a comprehensive analysis pipeline on Reddit user profiles.

## Architecture

The system is divided into two primary components:

*   **Intellitrace (Frontend)**: A desktop application built with Electron, providing a frameless UI to input usernames, stream analysis logs, and visualize the final probability metrics.
*   **Backend (FastAPI)**: A REST API that orchestrates the machine learning and LLM pipelines, evaluating users across four main criteria:
    *   **Ideology & Intent**: Uses Gemini AI to detect spam, propaganda, and running bits.
    *   **AI Authenticity**: Uses Gemini AI to evaluate hallmarks of Large Language Model generation.
    *   **Posting Frequency**: Analyzes post counts using a trained XGBoost model.
    *   **Rhythmic Patterns**: Evaluates gaps, sleep hours, and posting variance using a trained XGBoost model.

## Folder Structure

*   `Intellitrace/`: Contains the Electron frontend code (`main.js`, `renderer.js`, `preload.js`, UI assets).
*   `Backend/`: Contains the FastAPI application (`main.py`), ML models (`XGBoost JSON files`), Gemini AI integration scripts (`AiGen.py`, `TextPattern.py`), and the Playwright web scraper (`webscraper.py`, `Scrapingtool.py`).

## Setup and Installation

### Backend Setup
1.  Navigate to the `Backend` directory.
2.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Create a `.env` file in the `Backend` directory with your API keys:
    ```env
    API="your_gemini_api_key"
    API_SECURITY_KEY="your_fastapi_security_key"
    ```
4.  Run the FastAPI server:
    ```bash
    uvicorn main:app --host 0.0.0.0 --port 8000
    ```
*(Note: The scraper tool relies on a bundled Chromium binary and can be packaged into an executable using PyInstaller via `Scrapingtool.spec`)*

### Frontend Setup
1.  Navigate to the `Intellitrace` directory.
2.  Install Node.js dependencies:
    ```bash
    npm install
    ```
3.  Start the Electron application:
    ```bash
    npm start
    ```

## Usage
1. Open the Intellitrace desktop application.
2. Click the gear icon (**API Settings**) in the bottom-left to configure your **API Base URL** (e.g., `http://localhost:8000`) and **X-API-Key** (must match `API_SECURITY_KEY`).
3. Enter a Reddit username (with or without the `u/` prefix) and click **Run Analysis**.
4. The system will launch the local scraper to retrieve the user's recent timeline, trigger the backend evaluation pipeline, and stream the resulting metrics back to the UI interface.

## Build and Distribution
To build a distributable Windows NSIS installer for the frontend:
```bash
npm run build
