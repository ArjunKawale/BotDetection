from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List, Dict, Any
import os, json
from dotenv import load_dotenv

# Import ONLY your ML models (removed webscraper and ConvText imports)
from TextPattern import run_ideology_model
from AiGen import run_text_authenticity_model
from FreqBotfn import run_frequency_model
from TimePatternBotfn import run_rhythm_model

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

def sse(payload: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(payload)}\n\n"


# -------- PYDANTIC SCHEMAS FOR INCOMING JSON --------
class MessageItem(BaseModel):
    type: str
    text: str

class MessagesWrapper(BaseModel):
    username: str
    messages: List[MessageItem]

class RhythmFeatures(BaseModel):
    total_posts: int
    median_gap_seconds: float
    gap_variance: float
    top_of_hour_ratio: float
    hour_variance: float
    avg_sleep_hours: float

class FullDataRequest(BaseModel):
    username: str
    messages: MessagesWrapper
    frequency_data: float
    rhythm_features: RhythmFeatures


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
def process_user(request: FullDataRequest, api_key: str = Depends(verify_api_key)):
    username = request.username
    
    # Convert the Pydantic models back into standard Python dictionaries 
    # so your existing ML functions can read them without breaking.
    user_messages = request.messages.model_dump()
    freq_val = request.frequency_data
    rhythm_dict = request.rhythm_features.model_dump()

    def event_stream():
        try:
            # Note: Steps 1 & 2 (Scraping/Parsing) are skipped because 
            # the data is now provided directly in the request payload.

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