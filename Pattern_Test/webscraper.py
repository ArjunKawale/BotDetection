import requests
from bs4 import BeautifulSoup
import json
import time

HEADERS = {
    "User-Agent": "research-bot-detection-script"
}

def scrape_comments(username, limit=10):
    url = f"https://old.reddit.com/user/{username}/comments/"
    r = requests.get(url, headers=HEADERS)
    soup = BeautifulSoup(r.text, "html.parser")

    comments = []

    for c in soup.select(".comment")[:limit]:
        body = c.select_one(".md")
        if body:
            comments.append({
                "type": "comment",
                "text": body.get_text(strip=True)
            })

    return comments


def scrape_posts(username, limit=10):
    url = f"https://old.reddit.com/user/{username}/submitted/"
    r = requests.get(url, headers=HEADERS)
    soup = BeautifulSoup(r.text, "html.parser")

    posts = []

    for p in soup.select(".thing")[:limit]:
        title = p.select_one(".title a")
        if title:
            posts.append({
                "type": "post",
                "text": title.get_text(strip=True)
            })

    return posts


def scrape_user(username):

    posts = scrape_posts(username, 100)
    time.sleep(2)

    comments = scrape_comments(username, 100)

    return {
        "username": username,
        "messages": posts + comments
    }


# Example
username = "haikusbot"

data = scrape_user(username)

with open("reddit_user_scraped_bot.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print("Saved to reddit_user_scraped_bot.json")