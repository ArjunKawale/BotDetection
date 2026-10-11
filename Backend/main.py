from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os, json
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Import ML model inference handlers
from TextPattern import run_ideology_model
from AiGen import run_text_authenticity_model
from FreqBotfn import predict_cadence
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
    timestamp: Optional[float] = None

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

class CadenceFeatures(BaseModel):
    burst_ratio: float
    quiet_window_hours: float
    posts_per_active_day: float
    log_lifespan_days: float
    comment_ratio: float

class FullDataRequest(BaseModel):
    username: str
    messages: MessagesWrapper
    # Backward compatible optional fields:
    frequency_data: Optional[float] = None
    rhythm_features: RhythmFeatures
    # New cadence features (can be provided directly by updated scrapers)
    cadence_features: Optional[CadenceFeatures] = None
    # Optional raw timeline or timestamp array if client passes raw timestamps directly
    full_timestamp_timeline: Optional[List[float]] = None


# Helper function to derive cadence features if client passed timestamps instead of features
def derive_cadence_from_messages(messages: List[MessageItem]) -> dict:
    timestamps = [m.timestamp for m in messages if m.timestamp is not None]
    types = [m.type for m in messages if m.timestamp is not None]

    ts = np.sort(np.array(timestamps, dtype=float))
    total_posts = len(ts)

    if total_posts < 2:
        return {
            'burst_ratio': 0.0,
            'quiet_window_hours': 12.0,
            'posts_per_active_day': 1.0,
            'log_lifespan_days': 1.0,
            'comment_ratio': 0.5
        }

    gaps = np.diff(ts).astype(float)
    gaps = gaps[gaps >= 0]

    # 1. Burst Ratio (< 120s)
    burst_threshold = 120.0
    burst_ratio = float(np.sum(gaps < burst_threshold) / len(gaps)) if len(gaps) > 0 else 0.0

    # 2. Quiet Window (Consecutive inactive hours)
    dts = pd.to_datetime(ts, unit='s')
    hours = dts.hour.values
    hour_counts = np.bincount(hours, minlength=24)
    doubled = np.concatenate([hour_counts, hour_counts])

    is_zero = (doubled == 0).astype(int)
    max_quiet, curr_quiet = 0, 0
    for z in is_zero:
        if z == 1:
            curr_quiet += 1
            max_quiet = max(max_quiet, curr_quiet)
        else:
            curr_quiet = 0
    quiet_window_hours = float(min(24, max_quiet))

    # 3. Lifespan & Rate
    lifespan_days = max(1.0, (ts[-1] - ts[0]) / 86400.0)
    unique_active_days = len(np.unique(dts.date))
    posts_per_active_day = float(total_posts / max(1, unique_active_days))
    log_lifespan_days = float(np.log10(lifespan_days + 1.0))

    # 4. Comment Ratio
    if len(types) > 0:
        is_comment = np.array([1 if t in ['comment', 'reply'] else 0 for t in types])
        comment_ratio = float(is_comment.mean())
    else:
        comment_ratio = 0.5

    return {
        'burst_ratio': burst_ratio,
        'quiet_window_hours': quiet_window_hours,
        'posts_per_active_day': posts_per_active_day,
        'log_lifespan_days': log_lifespan_days,
        'comment_ratio': comment_ratio
    }


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
    
    user_messages = request.messages.model_dump()
    rhythm_dict = request.rhythm_features.model_dump()

    # Determine cadence feature inputs:
    if request.cadence_features is not None:
        cadence_dict = request.cadence_features.model_dump()
    else:
        # Compute dynamically from timestamps in messages if available
        cadence_dict = derive_cadence_from_messages(request.messages.messages)

    def event_stream():
        try:
            # STEP 3a — Ideology model
            yield sse({"step": "ideology",   "message": "Analyzing content & ideology…"})
            ideology = run_ideology_model(user_messages)

            # STEP 3b — AI-gen model
            yield sse({"step": "aigen",      "message": "Detecting AI-generated text…"})
            ai_auth  = run_text_authenticity_model(user_messages)

            # STEP 3c — Cadence / Frequency model (Updated with HC3)
            yield sse({"step": "frequency",  "message": "Evaluating posting cadence & circadian rhythm…"})
            freq     = predict_cadence(cadence_dict)

            # STEP 3d — Rhythm model (TimePatternBot)
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
                    "overall_probability": round(overall_prob, 2),
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