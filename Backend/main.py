from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

# Models
from TextPattern import run_ideology_model
from AiGen import run_text_authenticity_model
from FreqBotfn import run_frequency_model
from TimePatternBotfn import run_rhythm_model

# ConvText
from ConvText import (
    extract_messages_from_file,
    extract_posting_frequency,
    extract_rhythm_features
)

# Scraper
from webScraperfn import scrape_and_save_user_data

app = FastAPI(title="Reddit Bot Detector - Automated Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Request Model --------
class UserRequest(BaseModel):
    username: str


def get_file_path(username: str):
    return f"reddit_user_{username}_scraped.json"


# -------- MAIN PIPELINE --------
@app.post("/api/v1/process-user")
def process_user(request: UserRequest):
    username = request.username

    try:
        # STEP 1: SCRAPE + SAVE
        file_path = scrape_and_save_user_data(username)

        if not os.path.exists(file_path):
            raise Exception("JSON file was not created")

        # STEP 2: PARSE
        user_messages = extract_messages_from_file(file_path)
        freq_val = extract_posting_frequency(file_path)
        rhythm_dict = extract_rhythm_features(file_path)

        # STEP 3: RUN MODELS
        results = {
            "ideology": run_ideology_model(user_messages),
            "ai_authenticity": run_text_authenticity_model(user_messages),
            "frequency": run_frequency_model(freq_val),
            "rhythm": run_rhythm_model(rhythm_dict)
        }

        return {
            "status": "Success",
            "username": username,
            "file_created": file_path,
            "full_analysis": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline Error: {str(e)}")


# -------- GET ENDPOINTS --------
@app.get("/api/v1/analysis/ideology/{username}")
def get_ideology_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run POST first")

    data = extract_messages_from_file(path)
    return {"username": username, "result": run_ideology_model(data)}


@app.get("/api/v1/analysis/aigen/{username}")
def get_aigen_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run POST first")

    data = extract_messages_from_file(path)
    return {"username": username, "result": run_text_authenticity_model(data)}


@app.get("/api/v1/analysis/frequency/{username}")
def get_frequency_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run POST first")

    val = extract_posting_frequency(path)
    return {"username": username, "result": run_frequency_model(val)}


@app.get("/api/v1/analysis/rhythm/{username}")
def get_rhythm_only(username: str):
    path = get_file_path(username)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run POST first")

    features = extract_rhythm_features(path)
    return {"username": username, "result": run_rhythm_model(features)}