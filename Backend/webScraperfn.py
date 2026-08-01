import json
import os
from webscraper import scrape_hybrid_data, calculate_rhythmic_features

def scrape_and_save_user_data(username: str) -> str:
    # STEP 1: Scrape (Calls the synchronous Playwright wrapper in webscraper.py)
    timestamps, messages = scrape_hybrid_data(username)

    # STEP 2: Compute rhythm features
    rhythm_features = calculate_rhythmic_features(timestamps)

    # STEP 3: Build JSON (100% preserved schema & keys)
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

    return filepath

if __name__ == "__main__":
    # Quick test run if executed directly
    test_user = "Plus-Affect-6365"
    saved_path = scrape_and_save_user_data(test_user)
    print(f"\n[+] SUCCESS: Pipeline saved user data to -> {saved_path}")