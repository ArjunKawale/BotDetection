from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Import the model wrappers
from TextPattern import run_ideology_model
from AiGen import run_text_authenticity_model
from FreqBotfn import run_frequency_model
from TimePatternBotfn import run_rhythm_model  # New Model Wrapper

# Import your extraction functions from the ConvText file
from ConvText import (
    extract_messages_from_file, 
    extract_posting_frequency, 
    extract_rhythm_features  # New Extraction Function
)

app = FastAPI(title="Reddit Bot Detector API")

class FileRequest(BaseModel):
    file_path: str

@app.post("/api/v1/analyze-ideology")
def analyze_ideology(request: FileRequest):
    try:
        user_data = extract_messages_from_file(request.file_path)
        llm_result = run_ideology_model(user_data)
        return {
            "endpoint": "TextPattern/Ideology",
            "username": user_data.get("username"),
            "result": llm_result
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/analyze-aigen")
def analyze_aigen(request: FileRequest):
    try:
        user_data = extract_messages_from_file(request.file_path)
        llm_result = run_text_authenticity_model(user_data)
        return {
            "endpoint": "AiGen/Authenticity",
            "username": user_data.get("username"),
            "result": llm_result
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/analyze-frequency")
def analyze_frequency(request: FileRequest):
    try:
        freq_value = extract_posting_frequency(request.file_path)
        xgb_result = run_frequency_model(freq_value)
        return {
            "endpoint": "FreqBotfn/Frequency",
            "file_path": request.file_path, 
            "result": xgb_result
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (KeyError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/analyze-rhythm")
def analyze_rhythm(request: FileRequest):
    """
    Endpoint for analyzing rhythmic posting patterns using the 6-feature XGBoost model.
    """
    # 1. Parse the JSON file to get the 6-feature dictionary
    try:
        features_dict = extract_rhythm_features(request.file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data extraction failed: {str(e)}")

    # 2. Run the XGBoost Rhythm model
    try:
        xgb_result = run_rhythm_model(features_dict)
        
        return {
            "endpoint": "TimePatternBotfn/Rhythm",
            "file_path": request.file_path, 
            "result": xgb_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model execution failed: {str(e)}")