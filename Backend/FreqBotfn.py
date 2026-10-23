import os
import xgboost as xgb
import pandas as pd

# Load cadence model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "cadence_bot_model_v2.json")
cadence_model = xgb.XGBClassifier()
if os.path.exists(MODEL_PATH):
    cadence_model.load_model(MODEL_PATH)
else:
    print(f"Warning: Model not found at {MODEL_PATH}")

FEATURE_COLUMNS = [
    'burst_ratio', 
    'quiet_window_hours', 
    'posts_per_active_day', 
    'log_lifespan_days', 
    'comment_ratio'
]

def predict_cadence(features: dict) -> dict:
    """
    Replaces old scalar frequency check with the robust cadence classification.
    """
    quiet_window = features.get('quiet_window_hours', 12.0)
    posts_per_day = features.get('posts_per_active_day', 1.0)

    # 1. Deterministic Physical Guardrails
    # Never sleeps + extreme daily output -> 24/7 trigger bot
    if quiet_window <= 1.0 and posts_per_day > 150.0:
        return {
            "prediction": "Bot",
            "bot_probability": 0.999,
            "human_probability": 0.001,
            "status": "Flagged by Rule: 24/7 uptime without sleep"
        }

    # Consistent 5+ hours sleep + low daily output -> Casual human
    if quiet_window >= 5.0 and posts_per_day <= 5.0:
        return {
            "prediction": "Human",
            "bot_probability": 0.015,
            "human_probability": 0.985,
            "status": "Flagged by Rule: Organic circadian downtime"
        }

    # 2. XGBoost Evaluation for active humans & stealth bots
    df = pd.DataFrame([features])[FEATURE_COLUMNS]
    pred = cadence_model.predict(df)[0]
    probs = cadence_model.predict_proba(df)[0]

    return {
        "prediction": "Bot" if pred == 1 else "Human",
        "bot_probability": float(probs[1]),
        "human_probability": float(probs[0]),
        "status": "Classified by Cadence Model"
    }