from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
import os, json
from dotenv import load_dotenv

from TextPattern import run_ideology_model
from AiGen import run_text_authenticity_model
from FreqBotfn import run_frequency_model
from TimePatternBotfn import run_rhythm_model
from ConvText import (
    extract_messages_from_file,
    extract_posting_frequency,
    extract_rhythm_features,
)
from webScraperfn import scrape_and_save_user_data

# Load environment variables
load_dotenv()
API_SECURITY_KEY = os.getenv("API_SECURITY_KEY")

app = FastAPI(title="Reddit Bot Detector - Automated Pipeline")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SECURITY SETUP ---
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

def verify_api_key(api_key: str = Security(api_key_header)):
    if not API_SECURITY_KEY:
        raise HTTPException(status_code=500, detail="Server missing API_SECURITY_KEY in .env")
    if api_key != API_SECURITY_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key


class UserRequest(BaseModel):
    username: str

def get_file_path(username: str):
    return os.path.join("UserData", f"reddit_user_{username}_scraped.json")

def sse(payload: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(payload)}\n\n"

# -------- ROOT ENDPOINT (Server Check) --------
@app.get("/")
def read_root():
    """Shows the server is running when visiting the base URL."""
    return {
        "status": "online", 
        "project": "Reddit Bot Detector API",
        "endpoints": "/docs"
    }


# -------- MAIN PIPELINE (streaming) --------
@app.post("/api/v1/process-user")
def process_user(request: UserRequest, api_key: str = Depends(verify_api_key)):
    username = request.username

    def event_stream():
        try:
            # STEP 1 — Scrape
            yield sse({"step": "scraping",   "message": "Gathering Reddit data…"})
            file_path = scrape_and_save_user_data(username)
            if not os.path.exists(file_path):
                raise Exception("JSON file was not created")

            # STEP 2 — Parse
            yield sse({"step": "parsing",    "message": "Parsing post history…"})
            user_messages = extract_messages_from_file(file_path)
            freq_val      = extract_posting_frequency(file_path)
            rhythm_dict   = extract_rhythm_features(file_path)

            # STEP 3a — Ideology model
            yield sse({"step": "ideology",   "message": "Analyzing content & ideology…"})
            ideology = run_ideology_model(user_messages)

            # STEP 3b — AI-gen model
            yield sse({"step": "aigen",      "message": "Detecting AI-generated text…"})
            ai_auth  = run_text_authenticity_model(user_messages)

            # STEP 3c — Frequency model
            yield sse({"step": "frequency",  "message": "Checking posting frequency…"})
            freq     = run_frequency_model(freq_val)

            # STEP 3d — Rhythm model
            yield sse({"step": "rhythm",     "message": "Analyzing posting rhythm…"})
            rhythm   = run_rhythm_model(rhythm_dict)

            # Calculate Overall Probability Safely
            p_ideo   = ideology.get("bot_probability", 0) if isinstance(ideology, dict) else 0
            p_aigen  = ai_auth.get("ai_probability", 0) if isinstance(ai_auth, dict) else 0
            p_freq   = freq.get("bot_probability", 0) if isinstance(freq, dict) else 0
            p_rhythm = rhythm.get("bot_probability", 0) if isinstance(rhythm, dict) else 0

            scores = [p_ideo, p_aigen, p_freq, p_rhythm]
            overall_prob = sum(scores) / len(scores)

            # DONE — send full result
            yield sse({
                "step": "done",
                "message": "Analysis complete!",
                "result": {
                    "status": "Success",
                    "username": username,
                    "file_created": file_path,
                    "overall_probability": overall_prob,
                    "is_bot_overall": overall_prob >= 0.5,
                    "full_analysis": {
                        "ideology":       ideology,
                        "ai_authenticity": ai_auth,
                        "frequency":      freq,
                        "rhythm":         rhythm,
                    },
                },
            })

        except Exception as e:
            yield sse({"step": "error", "message": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# -------- GET ENDPOINTS --------
@app.get("/api/v1/analysis/ideology/{username}")
def get_ideology_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path): raise HTTPException(404, "Run POST first")
    return {"username": username, "result": run_ideology_model(extract_messages_from_file(path))}

@app.get("/api/v1/analysis/aigen/{username}")
def get_aigen_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path): raise HTTPException(404, "Run POST first")
    return {"username": username, "result": run_text_authenticity_model(extract_messages_from_file(path))}

@app.get("/api/v1/analysis/frequency/{username}")
def get_frequency_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path): raise HTTPException(404, "Run POST first")
    return {"username": username, "result": run_frequency_model(extract_posting_frequency(path))}

@app.get("/api/v1/analysis/rhythm/{username}")
def get_rhythm_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path): raise HTTPException(404, "Run POST first")
    return {"username": username, "result": run_rhythm_model(extract_rhythm_features(path))}