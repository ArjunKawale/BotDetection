import argparse
import json
import os
import sys

# Reddit scraper & feature extraction
from webScraperfn import scrape_and_save_user_data
from ConvText import (
    extract_messages_from_file,
    extract_posting_frequency,
    extract_rhythm_features,
)

# Bluesky scraper & rhythm calculation
from bsky_scraper import scrape_bluesky_user
from webscraper import calculate_rhythmic_features


def process_target(target: str):
    # Sanitize input: remove leading @ or u/
    target = target.strip().lstrip("@")
    if target.startswith("u/"):
        target = target[2:]

    print(f"[*] Starting collection for target: {target}")
    os.makedirs("UserData", exist_ok=True)

    try:
        # Route to Bluesky: any domain-style handle containing a dot
        if "." in target:
            times, texts = scrape_bluesky_user(target)
            if not times and not texts:
                print(f"[!] Error: No data found for Bluesky user '{target}'.")
                sys.exit(1)

            rhythm_raw = calculate_rhythmic_features(times)
            freq_val = float(rhythm_raw.get("posting_frequency_days", 0.0))

            # Match Pydantic's RhythmFeatures schema exactly
            rhythm_dict = {
                "total_posts": int(rhythm_raw.get("total_posts", 0)),
                "median_gap_seconds": float(rhythm_raw.get("median_gap_seconds", 0.0)),
                "gap_variance": float(rhythm_raw.get("gap_variance", 0.0)),
                "top_of_hour_ratio": float(rhythm_raw.get("top_of_hour_ratio", 0.0)),
                "hour_variance": float(rhythm_raw.get("hour_variance", 0.0)),
                "avg_sleep_hours": float(rhythm_raw.get("avg_sleep_hours", 0.0)),
            }

            # Match Pydantic's MessagesWrapper schema
            user_messages = {
                "username": target,
                "messages": [
                    {"type": msg["type"], "text": msg["text"]} for msg in texts
                ],
            }

            formatted_data = {
                "username": target,
                "messages": user_messages,
                "frequency_data": freq_val,
                "rhythm_features": rhythm_dict,
            }

        # Route to Reddit (standard alphanumeric usernames)
        else:
            raw_file_path = scrape_and_save_user_data(target)
            if not os.path.exists(raw_file_path):
                print(
                    f"[!] Error: Raw data file for Reddit user '{target}' was not created."
                )
                sys.exit(1)

            print(f"[*] Raw data saved to {raw_file_path}. Formatting now...")
            user_messages = extract_messages_from_file(raw_file_path)
            freq_val = extract_posting_frequency(raw_file_path)
            rhythm_dict = extract_rhythm_features(raw_file_path)

            formatted_data = {
                "username": target,
                "messages": user_messages,
                "frequency_data": freq_val,
                "rhythm_features": rhythm_dict,
            }

        output_file = os.path.join("UserData", f"formatted_{target}.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(formatted_data, f, indent=4)

        print(f"[+] Formatted data successfully saved to: {output_file}")

    except Exception as e:
        print(f"[!] Error during processing: {e}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape and format user data across platforms."
    )
    parser.add_argument(
        "target", help="Reddit username or Bluesky handle to scrape"
    )
    args = parser.parse_args()

    process_target(args.target)