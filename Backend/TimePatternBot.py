import xgboost as xgb
import pandas as pd
import json
import numpy as np

def predict_bot_status(data_json_path, model_path):
    # 1. Load the Scraped Data
    with open(data_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 2. Extract the features from the specific rhythm dictionary
    # We map them to the exact names the XGBoost model expects
    stats = data.get("rhythm_features_7_day_basis", {})
    
    # Define features in the EXACT order used during training
    feature_data = {
        "total_posts": stats.get("total_posts"),
        "median_gap_seconds": stats.get("median_gap_seconds"),
        "gap_variance": stats.get("gap_variance"),
        "top_of_hour_ratio": stats.get("top_of_hour_ratio"),
        "hour_variance": stats.get("hour_variance"),
        "avg_sleep_hours": stats.get("avg_sleep_hours")
    }
    
    # 3. Convert to DataFrame (XGBoost requirement)
    df_input = pd.DataFrame([feature_data])
    
    # 4. Load the XGBoost Model
    model = xgb.XGBClassifier()
    model.load_model(model_path)
    
    # 5. Get Prediction and Probability
    prediction = model.predict(df_input)[0]
    probability = model.predict_proba(df_input)[0]
    
    # 6. Output Results
    verdict = "🤖 BOT" if prediction == 1 else "👤 HUMAN"
    confidence = probability[1] if prediction == 1 else probability[0]
    
    print("-" * 30)
    print(f"User: {data.get('username')}")
    print(f"Verdict: {verdict}")
    print(f"Confidence: {confidence * 100:.2f}%")
    print("-" * 30)
    
    return verdict, confidence

# --- Execution ---
if __name__ == "__main__":
    # Update these paths to match your local files
    SCRAPED_JSON = "reddit_user_AutoModerator_hybrid.json"
    MODEL_JSON = "reddit_bot_model_rhythmic_patterns.json"
    
    try:
        predict_bot_status(SCRAPED_JSON, MODEL_JSON)
    except FileNotFoundError as e:
        print(f"Error: Could not find file. {e}")
    except Exception as e:
        print(f"An error occurred: {e}")