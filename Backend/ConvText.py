import json
import os
import numpy as np
import pandas as pd

def extract_messages_from_file(file_path: str) -> dict:
    """
    Reads a JSON file and extracts only the username and the messages
    (type and text) from the timeline.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Could not find the file: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    username = raw_data.get("username", "UnknownUser")
    timeline = raw_data.get("timeline", [])

    messages = [
        {
            "type": item.get("type"),
            "text": item.get("text")
        }
        for item in timeline if "text" in item
    ]

    return {
        "username": username,
        "messages": messages
    }


def extract_cadence_features(file_path: str) -> dict:
    """
    Extracts the 5 robust features required by the cadence_bot_model_v2
    directly from raw timeline timestamps, preventing human burst false-positives.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Could not find the file: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    timestamps = []
    types = []

    # Handle Reddit and Bluesky payload layouts
    if "full_timestamp_timeline" in raw_data and len(raw_data["full_timestamp_timeline"]) > 0:
        timestamps = raw_data["full_timestamp_timeline"]
        if "messages" in raw_data and isinstance(raw_data["messages"], dict):
            types = [item.get("type", "post") for item in raw_data["messages"].get("messages", [])]
    elif "timeline" in raw_data:
        timestamps = [item["timestamp"] for item in raw_data["timeline"] if "timestamp" in item]
        types = [item.get("type", "comment") for item in raw_data["timeline"]]
    elif "recent_100_messages" in raw_data:
        timestamps = [item["timestamp"] for item in raw_data["recent_100_messages"] if "timestamp" in item]
        types = [item.get("type", "post") for item in raw_data["recent_100_messages"]]

    ts = np.sort(np.array(timestamps, dtype=float))
    total_posts = len(ts)

    if total_posts < 2:
        return {
            'burst_ratio': 0.0,
            'quiet_window_hours': 12.0,
            'posts_per_active_day': 1.0,
            'log_lifespan_days': 1.0,
            'comment_ratio': 0.5
        }

    gaps = np.diff(ts).astype(float)
    gaps = gaps[gaps >= 0]

    # 1. Burst Ratio (< 120s)
    burst_threshold = 120.0
    burst_ratio = float(np.sum(gaps < burst_threshold) / len(gaps)) if len(gaps) > 0 else 0.0

    # 2. Quiet Window (Consecutive 24-hr inactive hours)
    dts = pd.to_datetime(ts, unit='s')
    hours = dts.hour.values
    hour_counts = np.bincount(hours, minlength=24)
    doubled = np.concatenate([hour_counts, hour_counts])

    is_zero = (doubled == 0).astype(int)
    max_quiet, curr_quiet = 0, 0
    for z in is_zero:
        if z == 1:
            curr_quiet += 1
            max_quiet = max(max_quiet, curr_quiet)
        else:
            curr_quiet = 0
    quiet_window_hours = float(min(24, max_quiet))

    # 3. Lifespan and posting density
    lifespan_days = max(1.0, (ts[-1] - ts[0]) / 86400.0)
    unique_active_days = len(np.unique(dts.date))
    posts_per_active_day = float(total_posts / max(1, unique_active_days))
    log_lifespan_days = float(np.log10(lifespan_days + 1.0))

    # 4. Action type ratio
    if len(types) > 0:
        is_comment = np.array([1 if t in ['comment', 'reply'] else 0 for t in types])
        comment_ratio = float(is_comment.mean())
    else:
        comment_ratio = 0.5

    return {
        'burst_ratio': burst_ratio,
        'quiet_window_hours': quiet_window_hours,
        'posts_per_active_day': posts_per_active_day,
        'log_lifespan_days': log_lifespan_days,
        'comment_ratio': comment_ratio
    }


def extract_rhythm_features(file_path: str) -> dict:
    """
    Extracts the 6 specific rhythm metrics as a dictionary for TimePatternBot.
    DO NOT MODIFY - REQUIRED BY TIMEPATTERNBOT.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Could not find the file: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    rhythm_data = raw_data.get("rhythm_features_7_day_basis") or raw_data.get("rhythm_features") or {}

    keys = [
        "total_posts",
        "median_gap_seconds",
        "gap_variance",
        "top_of_hour_ratio",
        "hour_variance",
        "avg_sleep_hours"
    ]

    extracted_features = {k: rhythm_data.get(k) for k in keys}

    if all(value is None for value in extracted_features.values()):
        raise KeyError(f"No rhythm features found in {file_path}. Check JSON structure.")

    return extracted_features