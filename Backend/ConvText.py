import json
import os

def extract_messages_from_file(file_path: str) -> dict:
    """
    Reads a JSON file and extracts only the username and the messages
    (type and text) from the timeline.
    """
    # 1. Verify the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Could not find the file: {file_path}")

    # 2. Open and load the JSON data
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # 3. Extract the target fields
    username = raw_data.get("username", "UnknownUser")
    timeline = raw_data.get("timeline", [])

    # 4. Clean the timeline into the required 'messages' format
    messages = [
        {
            "type": item.get("type"),
            "text": item.get("text")
        }
        for item in timeline if "text" in item
    ]

    # 5. Build the final dictionary
    cleaned_data = {
        "username": username,
        "messages": messages
    }

    return cleaned_data

def extract_posting_frequency(file_path: str) -> float:
    """
    Reads a JSON file and extracts only the posting_frequency_days value.
    """
    # 1. Verify the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Could not find the file: {file_path}")

    # 2. Open and load the JSON data
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # 3. Locate the rhythm features dictionary
    # It checks both naming conventions you provided in your earlier examples
    rhythm_data = raw_data.get("rhythm_features_7_day_basis") or raw_data.get("rhythm_features") or {}

    # 4. Extract the specific value
    frequency = rhythm_data.get("posting_frequency_days")

    if frequency is None:
        raise KeyError(f"'posting_frequency_days' was not found in the JSON file: {file_path}")

    return float(frequency)


def extract_rhythm_features(file_path: str) -> dict:
    """
    Extracts the 6 specific rhythm metrics as a dictionary.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Could not find the file: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # Support both possible key names
    rhythm_data = raw_data.get("rhythm_features_7_day_basis") or raw_data.get("rhythm_features") or {}

    # List of keys you requested
    keys = [
        "total_posts",
        "median_gap_seconds",
        "gap_variance",
        "top_of_hour_ratio",
        "hour_variance",
        "avg_sleep_hours"
    ]

    # Create the dictionary using only the requested keys
    extracted_features = {k: rhythm_data.get(k) for k in keys}

    # Check if any crucial values are missing (None)
    if all(value is None for value in extracted_features.values()):
        raise KeyError(f"No rhythm features found in {file_path}. Check JSON structure.")

    return extracted_features