import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict
from pathlib import Path
from playwright.async_api import async_playwright


def get_chrome_path() -> Path:
    """
    Locates the bundled Chromium executable whether running from source
    or as a frozen PyInstaller binary on Linux.
    """
    if getattr(sys, "frozen", False):
        # PyInstaller extracts to sys._MEIPASS in --onefile mode,
        # or runs from the executable's directory in --onedir mode
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    else:
        base = Path(__file__).parent

    matches = list(base.glob("chromium-*"))
    if not matches:
        raise FileNotFoundError(
            f"No bundled Chromium found in '{base}'. Ensure chromium-1228 is copied to the project root."
        )

    chromium_dir = matches[0]
    chrome_exec = chromium_dir / "chrome-linux64" / "chrome"

    if not chrome_exec.exists():
        raise FileNotFoundError(f"Chromium binary not found at expected path: {chrome_exec}")

    return chrome_exec


async def _scrape_hybrid_data_async(username: str):
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).timestamp()

    full_timestamp_timeline = []
    recent_text_items = []
    collected_100 = False

    print(f" Processing user /u/{username} via Playwright DOM scraping...")

    async with async_playwright() as p:
        # Launch using the bundled Chromium binary path
        browser = await p.chromium.launch(
            executable_path=str(get_chrome_path()),
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars"
            ]
        )

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1"
            }
        )

        page = await context.new_page()
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        current_url = f"https://old.reddit.com/user/{username}/"

        try:
            while True:
                response = await page.goto(current_url, wait_until="domcontentloaded", timeout=20000)
                if response.status != 200:
                    print(f"[ERROR] Status: {response.status} on {current_url}")
                    break

                await page.wait_for_timeout(1500)

                # Extract all things on the current page via JS
                page_items = await page.evaluate("""() => {
                    const results = [];
                    const things = document.querySelectorAll('.thing:not(.promotedlink)');

                    things.forEach(el => {
                        const permalink = el.getAttribute('data-permalink');
                        const dataType = el.getAttribute('data-type');

                        // 1. Try top-level data-timestamp (Works for Posts)
                        let rawTs = el.getAttribute('data-timestamp');
                        let timestamp = rawTs ? (parseInt(rawTs, 10) / 1000) : null;

                        // 2. Fallback: Check nested <time> tag (Required for Comments on Old Reddit)
                        if (!timestamp) {
                            const timeEl = el.querySelector('time[datetime]');
                            if (timeEl) {
                                const dtStr = timeEl.getAttribute('datetime');
                                const parsedDate = Date.parse(dtStr);
                                if (!isNaN(parsedDate)) {
                                    timestamp = parsedDate / 1000;
                                }
                            }
                        }

                        let title = null;
                        let text = null;

                        if (dataType === 'link' || el.classList.contains('link')) {
                            const titleEl = el.querySelector('a.title');
                            title = titleEl ? titleEl.innerText.trim() : 'Untitled Post';

                            const bodyEl = el.querySelector('.usertext-body .md');
                            text = bodyEl ? bodyEl.innerText.trim() : null;
                        } else {
                            const bodyEl = el.querySelector('.usertext-body .md');
                            text = bodyEl ? bodyEl.innerText.trim() : 'No text content';
                        }

                        results.push({
                            type: (dataType === 'link' || el.classList.contains('link')) ? 'post' : 'comment',
                            title: title,
                            text: text,
                            timestamp: timestamp
                        });
                    });

                    return results;
                }""")

                if not page_items:
                    break

                for item in page_items:
                    ts = item["timestamp"]
                    if not ts:
                        continue

                    # -------------------------------
                    # PHASE 1: FIRST 100 ACTIVITIES
                    # -------------------------------
                    if len(recent_text_items) < 100:
                        text_val = item["title"] if item["type"] == "post" else item["text"]
                        recent_text_items.append({
                            "type": item["type"],
                            "text": text_val,
                            "timestamp": ts
                        })
                        full_timestamp_timeline.append(ts)

                        if len(recent_text_items) == 100:
                            collected_100 = True

                    # ----------------------------------
                    # PHASE 2: AFTER 100 (timestamps only)
                    # ----------------------------------
                    else:
                        if ts >= one_week_ago:
                            full_timestamp_timeline.append(ts)
                        else:
                            # Stop everything once we cross 1-week boundary
                            return full_timestamp_timeline, recent_text_items

                # Pagination: Find 'Next' button
                next_button = page.locator("span.nextprev a[rel~='next']").first
                if await next_button.count() == 0:
                    break

                current_url = await next_button.get_attribute("href")

        except Exception as e:
            print(f"[ERROR] Scraping failed: {e}")
        finally:
            await browser.close()

    return full_timestamp_timeline, recent_text_items


def scrape_hybrid_data(username: str):
    """
    Synchronous wrapper so existing code can call scrape_hybrid_data(username) normally.
    """
    return asyncio.run(_scrape_hybrid_data_async(username))


def calculate_rhythmic_features(timestamps):
    """
    Calculates features. posting_frequency_days uses the OLD MEDIAN GAP logic.
    """
    timestamps.sort()
    total_actions = len(timestamps)

    if total_actions == 0:
        return {
            "total_posts": 0,
            "posting_frequency_days": 0,
            "median_gap_seconds": 0,
            "gap_variance": 0,
            "top_of_hour_ratio": 0,
            "hour_variance": 0,
            "avg_sleep_hours": 0,
            "status": "NO DATA"
        }

    raw_gaps = [timestamps[i] - timestamps[i-1] for i in range(1, total_actions)]
    gaps = [g for g in raw_gaps if g < 2592000]

    median_gap_seconds = statistics.median(gaps) if gaps else 0
    gap_var = statistics.variance(gaps) if len(gaps) > 1 else 0

    posting_frequency_days = median_gap_seconds / 86400.0

    dt_objects = [datetime.fromtimestamp(ts, tz=timezone.utc) for ts in timestamps]
    hours = [dt.hour for dt in dt_objects]
    h_var = statistics.variance(hours) if len(hours) > 1 else 0

    cron_hits = sum(1 for dt in dt_objects if dt.minute in (0, 30))
    cron_ratio = cron_hits / total_actions if total_actions else 0

    daily_gaps = defaultdict(list)
    for i in range(1, total_actions):
        day = dt_objects[i].date()
        daily_gaps[day].append(raw_gaps[i-1])

    max_gaps = [max(g) for g in daily_gaps.values()] if daily_gaps else []
    sleep_hrs = (sum(max_gaps) / len(max_gaps)) / 3600 if max_gaps else 0

    return {
        "total_posts": total_actions,
        "posting_frequency_days": round(posting_frequency_days, 6),
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

    print(f"\n Analysis Complete for /u/{target_user}")
    print(f" Total Posts (Week): {rhythm_features.get('total_posts', 0)}")
    print(f" Original Frequency Metric: {rhythm_features.get('posting_frequency_days', 0)}")
    print(f" Data saved to {filename}")