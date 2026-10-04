import asyncio
import json
import logging
import os
import random
import statistics
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("webscraper")

STATE_FILE = Path("reddit_state.json")
WINDOW_DAYS = 7
TEXT_TARGET = 100
MAX_PAGES = 10

def get_chrome_path() -> Path | None:
    """Locate bundled Chromium executable if available, else let Playwright use its managed binary."""
    base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) if getattr(sys, "frozen", False) else Path(__file__).parent
    matches = list(base.glob("chromium-*"))
    if matches:
        chrome_exec = matches[0] / "chrome-linux64" / "chrome"
        if chrome_exec.exists():
            return chrome_exec
    return None

async def ensure_authenticated_session() -> None:
    """If no saved login state exists, opens a visible browser for one-time manual login."""
    if STATE_FILE.exists():
        return

    log.info("[*] No saved Reddit session found. Opening browser for one-time login...")
    async with async_playwright() as p:
        exe = get_chrome_path()
        launch_kwargs = {"headless": False}
        if exe:
            launch_kwargs["executable_path"] = str(exe)

        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US")
        page = await context.new_page()

        await page.goto("https://www.reddit.com/login", wait_until="domcontentloaded")
        print("\n" + "=" * 60)
        print(">>> Please LOG IN to Reddit in the opened browser window.")
        print(">>> Once logged in successfully, press ENTER in this terminal.")
        print("=" * 60 + "\n")

        await asyncio.to_thread(input, "Press ENTER after logging in... ")

        # Save cookies & storage state
        await context.storage_state(path=str(STATE_FILE))
        try:
            os.chmod(STATE_FILE, 0o600)
        except OSError:
            pass
        log.info("[+] Session saved successfully to %s", STATE_FILE)
        await browser.close()

async def _fetch_user_json(context, username: str):
    """Fetches user activity using Reddit's user listing JSON via authenticated browser context."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)).timestamp()
    full_timestamp_timeline = []
    recent_text_items = []

    after = None
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }

    for page_idx in range(MAX_PAGES):
        url = f"https://www.reddit.com/user/{username}/overview.json?limit=100&raw_json=1"
        if after:
            url += f"&after={after}"

        log.info(f"[*] Requesting page {page_idx + 1} for u/{username}...")
        resp = await context.request.get(url, headers=headers)

        if resp.status == 429:
            log.warning("[!] Rate limited by Reddit. Sleeping 10 seconds...")
            await asyncio.sleep(10)
            continue

        if resp.status != 200:
            log.warning(f"[!] Endpoint returned HTTP {resp.status}. Response: {await resp.text()[:200]}")
            break

        data = await resp.json()
        children = data.get("data", {}).get("children", [])
        if not children:
            break

        for item in children:
            d = item.get("data", {})
            kind = item.get("kind")
            ts = d.get("created_utc")
            if not ts:
                continue

            # Determine post or comment
            is_post = (kind == "t3")
            if is_post:
                title = d.get("title", "")
                selftext = d.get("selftext", "").strip()
                text = f"{title}\n\n{selftext}" if selftext else title
                msg_type = "post"
            else:
                text = d.get("body", "")
                msg_type = "comment"

            # Store recent 100 text messages
            if len(recent_text_items) < TEXT_TARGET:
                recent_text_items.append({
                    "type": msg_type,
                    "text": text,
                    "timestamp": ts
                })
                full_timestamp_timeline.append(ts)
            elif ts >= cutoff:
                full_timestamp_timeline.append(ts)
            else:
                return full_timestamp_timeline, recent_text_items

        after = data.get("data", {}).get("after")
        if not after:
            break

        await asyncio.sleep(random.uniform(1.0, 2.0))

    return full_timestamp_timeline, recent_text_items

async def _scrape_hybrid_data_async(username: str):
    await ensure_authenticated_session()

    async with async_playwright() as p:
        exe = get_chrome_path()
        launch_kwargs = {"headless": True}
        if exe:
            launch_kwargs["executable_path"] = str(exe)

        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            storage_state=str(STATE_FILE),
            locale="en-US"
        )

        try:
            timeline, texts = await _fetch_user_json(context, username)
            return timeline, texts
        finally:
            await browser.close()

def scrape_hybrid_data(username: str):
    """Synchronous interface matching webScraperfn.py signature."""
    return asyncio.run(_scrape_hybrid_data_async(username))

def calculate_rhythmic_features(timestamps: list[float]) -> dict:
    """Exact 6-feature rhythm calculator matching model training inputs."""
    timestamps = sorted(timestamps)
    total_actions = len(timestamps)

    if total_actions == 0:
        return {
            "total_posts": 0,
            "posting_frequency_days": 0.0,
            "median_gap_seconds": 0.0,
            "gap_variance": 0.0,
            "top_of_hour_ratio": 0.0,
            "hour_variance": 0.0,
            "avg_sleep_hours": 0.0,
            "status": "NO DATA"
        }

    raw_gaps = [timestamps[i] - timestamps[i - 1] for i in range(1, total_actions)]
    gaps = [g for g in raw_gaps if g < 2592000]

    median_gap_seconds = statistics.median(gaps) if gaps else 0.0
    gap_var = statistics.variance(gaps) if len(gaps) > 1 else 0.0
    posting_frequency_days = median_gap_seconds / 86400.0

    dt_objects = [datetime.fromtimestamp(ts, tz=timezone.utc) for ts in timestamps]
    hours = [dt.hour for dt in dt_objects]
    h_var = statistics.variance(hours) if len(hours) > 1 else 0.0

    cron_hits = sum(1 for dt in dt_objects if dt.minute in (0, 30))
    cron_ratio = cron_hits / total_actions if total_actions else 0.0

    daily_gaps = defaultdict(list)
    for i in range(1, total_actions):
        day = dt_objects[i].date()
        daily_gaps[day].append(raw_gaps[i - 1])

    max_gaps = [max(g) for g in daily_gaps.values()] if daily_gaps else []
    sleep_hrs = (sum(max_gaps) / len(max_gaps)) / 3600 if max_gaps else 0.0

    return {
        "total_posts": int(total_actions),
        "posting_frequency_days": round(float(posting_frequency_days), 6),
        "median_gap_seconds": round(float(median_gap_seconds), 2),
        "gap_variance": round(float(gap_var), 2),
        "top_of_hour_ratio": round(float(cron_ratio), 4),
        "hour_variance": round(float(h_var), 2),
        "avg_sleep_hours": round(float(sleep_hrs), 2)
    }

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "AutoModerator"
    times, texts = scrape_hybrid_data(target)
    feats = calculate_rhythmic_features(times)
    print(f"\n[+] Results for u/{target}:")
    print(f"    Total posts in 7d window: {len(times)}")
    print(f"    Recent messages collected: {len(texts)}")
    print(f"    Top of hour ratio: {feats['top_of_hour_ratio']}")
    print(f"    Avg sleep hours: {feats['avg_sleep_hours']}")