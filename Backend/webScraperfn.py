import json
from  webscraper import scrape_hybrid_data, calculate_rhythmic_features


def scrape_and_save_user_data(username: str) -> str:
    """
    Orchestrates scraping + feature calculation + JSON saving.
    Returns file path.
    """

    # STEP 1: Scrape
    timestamps, messages = scrape_hybrid_data(username)

    # STEP 2: Compute rhythm features
    rhythm_features = calculate_rhythmic_features(timestamps)

    # STEP 3: Build JSON (IMPORTANT: match ConvText expectations)
    final_output = {
        "username": username,

        # ConvText expects this key
        "rhythm_features_7_day_basis": rhythm_features,

        # ConvText expects "timeline", NOT "recent_100_messages"
        "timeline": messages,

        # optional but useful
        "full_timestamp_timeline": timestamps
    }

    # STEP 4: Save
    filename = f"reddit_user_{username}_scraped.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)

    return filename