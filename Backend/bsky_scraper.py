import time
import json
import requests
from datetime import datetime, timezone

# Reuse your existing rhythm calculator
from webscraper import calculate_rhythmic_features

def scrape_bluesky_user(handle: str):
    """
    Fetches up to 7 days of timestamps and 100 recent posts for a Bluesky user.
    Uses the unauthenticated public AT Protocol HTTP API.
    """
    # Append default domain if the user only types the prefix
    if "." not in handle:
        handle += ".bsky.social"
        
    print(f"[*] Fetching Bluesky data for actor: {handle}")
    
    feed_url = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed"
    recent_text_items = []
    full_timestamp_timeline = []
    
    cursor = None
    one_week_ago = datetime.now(timezone.utc).timestamp() - (7 * 24 * 3600)
    
    while True:
        params = {
            "actor": handle,
            "limit": 100,
            "filter": "posts_no_replies" # Excludes replies to keep the dataset focused on core activity
        }
        if cursor:
            params["cursor"] = cursor
            
        try:
            resp = requests.get(feed_url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[!] API Request failed: {e}")
            break
            
        feed = data.get("feed", [])
        if not feed:
            break
            
        for item in feed:
            post = item.get("post", {})
            record = post.get("record", {})
            
            # Skip reposts made by the target user (we only want their original cadence/text)
            if post.get("author", {}).get("handle") != handle:
                continue
                
            text = record.get("text", "")
            created_at_str = record.get("createdAt")
            
            if not created_at_str:
                continue
                
            try:
                # Handle Bluesky's ISO 8601 format natively
                dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                ts = dt.timestamp()
            except ValueError:
                continue
                
            # 1. Collect up to 100 recent text payloads for Semantic Analysis
            if len(recent_text_items) < 100:
                recent_text_items.append({
                    "type": "post",
                    "text": text,
                    "timestamp": ts
                })
                
            # 2. Collect all timestamps within the 7-day window for Rhythm Analysis
            if ts >= one_week_ago:
                full_timestamp_timeline.append(ts)
            else:
                # Stop paginating if we have 100 texts AND hit the 1-week boundary
                if len(recent_text_items) >= 100:
                    return full_timestamp_timeline, recent_text_items
                    
        cursor = data.get("cursor")
        if not cursor:
            break
            
        time.sleep(0.2) # Basic rate limit respect
        
    return full_timestamp_timeline, recent_text_items

if __name__ == "__main__":
    target_user = "horsedisc.bsky.social" # Example handle
    
    times, texts = scrape_bluesky_user(target_user)
    
    if not times and not texts:
        print("[!] No data found or user does not exist.")
    else:
        # Calculate features using your existing webscraper.py logic
        rhythm_features = calculate_rhythmic_features(times)
        
        final_output = {
            "username": target_user,
            "rhythm_features_7_day_basis": rhythm_features,
            "recent_100_messages": texts,
            "full_timestamp_timeline": times
        }
        
        filename = f"bluesky_user_{target_user}_hybrid.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(final_output, f, indent=2)
            
        print(f"\n[+] Analysis Complete for {target_user}")
        print(f"    Total Posts (Week): {rhythm_features.get('total_posts', 0)}")
        print(f"    Data saved to {filename}")