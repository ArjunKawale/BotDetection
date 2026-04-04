import xgboost as xgb
import pandas as pd

# Load the model globally so it doesn't reload from the hard drive on every single API request
try:
    freq_model = xgb.XGBClassifier()
    freq_model.load_model("reddit_bot_model_posting_frequency.json")
except Exception as e:
    print(f"Warning: Could not load XGBoost model. {e}")

def run_frequency_model(posting_frequency_days: float) -> dict:
    """
    Takes the posting frequency float directly and returns the bot probability.
    """
    # 1. Create DataFrame with the EXACT column name used during training
    df_input = pd.DataFrame([{"posting_frequency_days": posting_frequency_days}])
    
    # 2. Predict
    prediction = freq_model.predict(df_input)[0]
    probabilities = freq_model.predict_proba(df_input)[0]
    
    # 3. Format Results
    is_bot = bool(prediction == 1)
    verdict = "🤖 BOT" if is_bot else "👤 HUMAN"
    
    # probability[1] is usually the probability of class 1 (Bot)
    bot_probability = float(probabilities[1])
    confidence = float(probabilities[1] if is_bot else probabilities[0])
    
    return {
        "is_bot": is_bot,
        "bot_probability": round(bot_probability, 4),
    }

# ==========================================
# How to use and test it with ConvText:
# ==========================================
if __name__ == "__main__":
    from ConvText import extract_posting_frequency
    import json
    
    test_file = "reddit_user_AutoModerator_hybrid.json"
    
    try:
        # 1. Extract using ConvText
        freq_value = extract_posting_frequency(test_file)
        print(f"Extracted Frequency: {freq_value}")
        
        # 2. Run the Model
        result = run_frequency_model(freq_value)
        
        # 3. Print Output
        print("\n=== XGBOOST FREQUENCY RESULT ===")
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error during testing: {e}")