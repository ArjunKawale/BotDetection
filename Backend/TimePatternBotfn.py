import xgboost as xgb
import pandas as pd

# 1. Load the Rhythm Model once at the top level
try:
    rhythm_model = xgb.XGBClassifier()
    rhythm_model.load_model("reddit_bot_model_rhythmic_patterns.json")
except Exception as e:
    print(f"CRITICAL ERROR: Could not load Rhythm XGBoost model. {e}")

def run_rhythm_model(features: dict) -> dict:
    """
    Takes a dictionary of the 6 rhythm features and returns verdict/confidence.
    Input expected: {total_posts, median_gap_seconds, gap_variance, 
                     top_of_hour_ratio, hour_variance, avg_sleep_hours}
    """
    
    # 2. Convert dictionary to DataFrame (XGBoost requirement)
    # The keys in the dict must match the feature names used during training
    df_input = pd.DataFrame([features])
    
    # 3. Get Prediction and Probability
    prediction = rhythm_model.predict(df_input)[0]
    probabilities = rhythm_model.predict_proba(df_input)[0]
    
    # 4. Format Results
    is_bot = bool(prediction == 1)
    verdict = "🤖 BOT" if is_bot else "👤 HUMAN"
    
    # bot_probability (index 1) vs human_probability (index 0)
    bot_probability = float(probabilities[1])
    confidence = float(probabilities[1] if is_bot else probabilities[0])
    
    return {
        "is_bot": is_bot,
        
        "bot_probability": round(bot_probability, 4),
       
    }

# ==========================================
# Testing Logic
# ==========================================
if __name__ == "__main__":
    from ConvText import extract_rhythm_features
    import json
    
    # Path to a file you want to test
    TEST_FILE = "reddit_user_AutoModerator_hybrid.json"
    
    try:
        # 1. Extract using your new ConvText function
        features_dict = extract_rhythm_features(TEST_FILE)
        
        # 2. Run the model
        result = run_rhythm_model(features_dict)
        
        print("\n=== RHYTHM MODEL ANALYSIS ===")
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {e}")