import requests
import json
import time
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict

HEADERS = {
    "User-Agent": "python:bot-detection-research-script:v7.0 (by /u/your_username)"
}

def scrape_hybrid_data(username):
    """
    Scrapes a full week of timestamps, but only keeps the text for the 100 most recent.
    """
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).timestamp()
    
    full_timestamp_timeline = [] # Will hold EVERY timestamp from the week
    recent_text_items = []       # Will hold only the top 100 text/type objects
    
    after_id = None
    print(f"⏳ Processing 7-day activity window for /u/{username}...")

    while True:
        url = f"https://old.reddit.com/user/{username}/.json?limit=100"
        if after_id:
            url += f"&after={after_id}"
            
        r = requests.get(url, headers=HEADERS)
        if r.status_code != 200:
            break
            
        data = r.json()
        children = data.get('data', {}).get('children', [])
        if not children:
            break

        reached_limit = False
        for child in children:
            item = child['data']
            ts = item.get('created_utc')
            
            # Stop if the activity is older than 7 days
            if ts < one_week_ago:
                reached_limit = True
                break
            
            # 1. Always save the timestamp for the XGBoost model
            full_timestamp_timeline.append(ts)
            
            # 2. Only save the TEXT if we haven't reached 100 items yet
            if len(recent_text_items) < 100:
                item_type = "post" if child['kind'] == "t3" else "comment"
                text = item.get('title') if item_type == "post" else item.get('body')
                recent_text_items.append({
                    "type": item_type,
                    "text": text,
                    "timestamp": ts
                })

        if reached_limit:
            break
            
        after_id = data.get('data', {}).get('after')
        if not after_id:
            break
            
        time.sleep(1) 

    return full_timestamp_timeline, recent_text_items

def calculate_rhythmic_features(timestamps):
    """
    Calculates features using the FULL WEEK of timestamps.
    This makes 'avg_sleep_hours' and 'hour_variance' extremely accurate.
    """
    timestamps.sort() # Oldest to Newest
    total_actions = len(timestamps)
    
    if total_actions < 5:
        return {"status": "INSUFFICIENT DATA"}

    # Calculate Gaps
    raw_gaps = [timestamps[i] - timestamps[i-1] for i in range(1, total_actions)]
    
    # Filter extreme outliers (over 30 days) just in case
    gaps = [g for g in raw_gaps if g < 2592000]
    
    median_gap = statistics.median(gaps) if gaps else 0
    gap_var = statistics.variance(gaps) if len(gaps) > 1 else 0
    
    # Circadian Math
    dt_objects = [datetime.fromtimestamp(ts, tz=timezone.utc) for ts in timestamps]
    hours = [dt.hour for dt in dt_objects]
    h_var = statistics.variance(hours) if len(hours) > 1 else 0
    
    # Cron Job Math
    cron_hits = sum(1 for dt in dt_objects if dt.minute in (0, 30))
    cron_ratio = cron_hits / total_actions

    # Sleep Math (Average of daily max gaps)
    daily_gaps = defaultdict(list)
    for i in range(1, total_actions):
        day = dt_objects[i].date()
        daily_gaps[day].append(raw_gaps[i-1])
    
    max_gaps = [max(g) for g in daily_gaps.values()]
    sleep_hrs = (sum(max_gaps) / len(max_gaps)) / 3600 if max_gaps else 0

    return {
        "total_actions_in_week": total_actions,
        "median_gap_seconds": round(median_gap, 2),
        "gap_variance": round(gap_var, 2),
        "top_of_hour_ratio": round(cron_ratio, 4),
        "hour_variance": round(h_var, 2),
        "avg_sleep_hours": round(sleep_hrs, 2)
    }

if __name__ == "__main__":
    user = "AutoModerator"
    
    # 1. Scrape the split data
    times, texts = scrape_hybrid_data(user)
    
    # 2. Calculate features using the full time history
    rhythm_features = calculate_rhythmic_features(times)
    
    # 3. Final JSON Structure
    final_output = {
        "username": user,
        "rhythm_features_7_day_basis": rhythm_features,
        "recent_100_messages": texts, # Only 100 here!
        "full_7_day_timestamps": times # Only numbers here!
    }

    with open(f"reddit_user_{user}_hybrid.json", "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)

    print(f"\n🚀 Features calculated from {len(times)} actions over 7 days.")
    print(f"📄 Saved {len(texts)} text samples for LLM analysis.")