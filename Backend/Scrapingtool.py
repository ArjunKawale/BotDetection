import argparse
import json
import os
import sys

from webScraperfn import scrape_and_save_user_data
from ConvText import (
    extract_messages_from_file,
    extract_rhythm_features,
    extract_cadence_features,
)

from bsky_scraper import scrape_bluesky_user
from webscraper import calculate_rhythmic_features, calculate_cadence_features

def process_target(target: str):
    target = target.strip().lstrip("@")
    if target.startswith("u/"):
        target = target[2:]

    print(f"[*] Starting collection for target: {target}")
    os.makedirs("UserData", exist_ok=True)

    try:
        # Route to Bluesky
        if "." in target:
            times, texts = scrape_bluesky_user(target)
            if not times and not texts:
                print(f"[!] Error: No data found for Bluesky user '{target}'.")
                sys.exit(1)

            # Extract features natively
            rhythm_dict = calculate_rhythmic_features(times)
            freq_val = float(rhythm_dict.get("posting_frequency_days", 0.0))
            
            action_types = [msg["type"] for msg in texts]
            cadence_dict = calculate_cadence_features(times, action_types)

            # Format strictly matching the target schema
            user_messages = {
                "username": target,
                "messages": [
                    {"type": msg["type"], "text": msg["text"], "timestamp": msg["timestamp"]} for msg in texts
                ],
            }

            formatted_data = {
                "username": target,
                "messages": user_messages,
                "frequency_data": freq_val,
                "rhythm_features": rhythm_dict,
                "cadence_features": cadence_dict,
                "full_timestamp_timeline": sorted(times)
            }

        # Route to Reddit
        else:
            raw_file_path = scrape_and_save_user_data(target)
            if not os.path.exists(raw_file_path):
                print(f"[!] Error: Raw data file for Reddit user '{target}' was not created.")
                sys.exit(1)

            print(f"[*] Raw data saved to {raw_file_path}. Formatting now...")
            user_messages = extract_messages_from_file(raw_file_path)
            
            # Add timestamps into the messages payload to match your required schema
            with open(raw_file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
            
            messages_with_ts = []
            for item in raw_data.get("timeline", []):
                if "text" in item:
                    messages_with_ts.append({
                        "type": item.get("type", "comment"),
                        "text": item.get("text", ""),
                        "timestamp": item.get("timestamp")
                    })
            user_messages["messages"] = messages_with_ts
            
            rhythm_dict = extract_rhythm_features(raw_file_path)
            cadence_dict = extract_cadence_features(raw_file_path)
            freq_val = float(rhythm_dict.get("posting_frequency_days", 0.0))

            formatted_data = {
                "username": target,
                "messages": user_messages,
                "frequency_data": freq_val,
                "rhythm_features": rhythm_dict,
                "cadence_features": cadence_dict,
                "full_timestamp_timeline": sorted(raw_data.get("full_timestamp_timeline", []))
            }

        output_file = os.path.join("UserData", f"formatted_{target}.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(formatted_data, f, indent=4)

        print(f"[+] Formatted data successfully saved to: {output_file}")

    except Exception as e:
        print(f"[!] Error during processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape and format user data across platforms.")
    parser.add_argument("target", help="Reddit username or Bluesky handle to scrape")
    args = parser.parse_args()

    process_target(args.target)