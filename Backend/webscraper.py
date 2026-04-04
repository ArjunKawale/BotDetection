import requests
import json
import time
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict

HEADERS = {
    "User-Agent": "python:bot-detection-research-script:v7.2 (by /u/your_username)"
}

def scrape_hybrid_data(username):
    """
    Scrapes up to a week of timestamps, but only keeps the text for the 100 most recent.
    """
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).timestamp()
    
    full_timestamp_timeline = [] 
    recent_text_items = []       
    
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
            
            if ts < one_week_ago:
                reached_limit = True
                break
            
            full_timestamp_timeline.append(ts)
            
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
    Calculates features. posting_frequency_days uses the OLD MEDIAN GAP logic.
    """
    timestamps.sort() 
    total_actions = len(timestamps)
    
    if total_actions < 5:
        return {"status": "INSUFFICIENT DATA"}

    # Calculate Gaps
    raw_gaps = [timestamps[i] - timestamps[i-1] for i in range(1, total_actions)]
    
    # Filter extreme outliers for variance math
    gaps = [g for g in raw_gaps if g < 2592000]
    
    median_gap_seconds = statistics.median(gaps) if gaps else 0
    gap_var = statistics.variance(gaps) if len(gaps) > 1 else 0
    
    # --- ORIGINAL FREQUENCY LOGIC ---
    # Convert median gap seconds into a "day" fraction
    posting_frequency_days = median_gap_seconds / 86400.0
    # --------------------------------

    # Circadian Math
    dt_objects = [datetime.fromtimestamp(ts, tz=timezone.utc) for ts in timestamps]
    hours = [dt.hour for dt in dt_objects]
    h_var = statistics.variance(hours) if len(hours) > 1 else 0
    
    # Cron Job Math
    cron_hits = sum(1 for dt in dt_objects if dt.minute in (0, 30))
    cron_ratio = cron_hits / total_actions

    # Sleep Math
    daily_gaps = defaultdict(list)
    for i in range(1, total_actions):
        day = dt_objects[i].date()
        daily_gaps[day].append(raw_gaps[i-1])
    
    max_gaps = [max(g) for g in daily_gaps.values()]
    sleep_hrs = (sum(max_gaps) / len(max_gaps)) / 3600 if max_gaps else 0

    return {
        "total_posts": total_actions,
        "posting_frequency_days": round(posting_frequency_days, 6), # Old manner
        "median_gap_seconds": round(median_gap_seconds, 2),
        "gap_variance": round(gap_var, 2),
        "top_of_hour_ratio": round(cron_ratio, 4),
        "hour_variance": round(h_var, 2),
        "avg_sleep_hours": round(sleep_hrs, 2)
    }

if __name__ == "__main__":
    target_user = "AutoModerator"
    
    times, texts = scrape_hybrid_data(target_user)
    rhythm_features = calculate_rhythmic_features(times)
    
    final_output = {
        "username": target_user,
        "rhythm_features_7_day_basis": rhythm_features,
        "recent_100_messages": texts, 
        "full_timestamp_timeline": times 
    }

    filename = f"reddit_user_{target_user}_hybrid.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)

    print(f"\n🚀 Analysis Complete for /u/{target_user}")
    print(f"📊 Total Posts (Week): {rhythm_features['total_posts']}")
    print(f"📈 Original Frequency Metric: {rhythm_features['posting_frequency_days']}")
    print(f"📄 Data saved to {filename}")