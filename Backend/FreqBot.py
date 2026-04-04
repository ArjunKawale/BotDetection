import xgboost as xgb
import pandas as pd
import json

def predict_with_old_model(data_json_path, model_path):
    # 1. Load the Scraped Data
    with open(data_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 2. Extract the specific frequency metric
    # Reaching into the rhythm features dictionary
    stats = data.get("rhythm_features_7_day_basis", {})
    freq_value = stats.get("posting_frequency_days")

    if freq_value is None:
        print("❌ Error: 'posting_frequency_days' not found in JSON.")
        return

    # 3. Create DataFrame with the EXACT column name used during training
    # If your old model used a different column name, change 'posting_frequency_days' here
    df_input = pd.DataFrame([{"posting_frequency_days": freq_value}])
    
    # 4. Load the Old XGBoost Model
    old_model = xgb.XGBClassifier()
    old_model.load_model(model_path)
    
    # 5. Predict
    prediction = old_model.predict(df_input)[0]
    probability = old_model.predict_proba(df_input)[0]
    
    # 6. Results
    verdict = "🤖 BOT" if prediction == 1 else "👤 HUMAN"
    # confidence is the prob of the winning class
    confidence = probability[1] if prediction == 1 else probability[0]
    
    print("--- 🔍 Old Model Prediction (Single Feature) ---")
    print(f"User        : {data.get('username')}")
    print(f"Frequency   : {freq_value}")
    print(f"Verdict     : {verdict}")
    print(f"Confidence  : {confidence * 100:.2f}%")
    print("-" * 45)

    return verdict, confidence

# --- Execution ---
if __name__ == "__main__":
    # Update these paths to match your files
    SCRAPED_JSON = "reddit_user_AutoModerator_hybrid.json"
    OLD_MODEL_JSON = "reddit_bot_model_posting_frequency.json" 
    
    predict_with_old_model(SCRAPED_JSON, OLD_MODEL_JSON)