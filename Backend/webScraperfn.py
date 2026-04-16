import json
import os
from huggingface_hub import HfApi # <-- Add this import
from webscraper import scrape_hybrid_data, calculate_rhythmic_features

def scrape_and_save_user_data(username: str) -> str:
    # STEP 1: Scrape
    timestamps, messages = scrape_hybrid_data(username)

    # STEP 2: Compute rhythm features
    rhythm_features = calculate_rhythmic_features(timestamps)

    # STEP 3: Build JSON
    final_output = {
        "username": username,
        "rhythm_features_7_day_basis": rhythm_features,
        "timeline": messages,
        "full_timestamp_timeline": timestamps
    }

    # STEP 4: Save locally
    save_dir = "UserData"
    os.makedirs(save_dir, exist_ok=True)
    filename = f"reddit_user_{username}_scraped.json"
    filepath = os.path.join(save_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)

    # STEP 5: Upload to Hugging Face Dataset
    try:
        api = HfApi()
        api.upload_file(
            path_or_fileobj=filepath,
            path_in_repo=filename, # The name it will have in the dataset
            repo_id="Cel-Est-ial-34929/reddit-Bot-Scraped", # <-- CHANGE THIS
            repo_type="dataset",
            token=os.getenv("HF_TOKEN")
        )
        print(f"Successfully backed up {username} to HF Dataset.")
    except Exception as e:
        print(f"Warning: Failed to upload to HF Dataset: {e}")

    return filepath