from playwright.sync_api import sync_playwright

def generate_state():
    with sync_playwright() as p:
        print("[*] Launching browser...")
        # headless=False so you can actually see the login screen
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(locale="en-US")
        page = context.new_page()
        
        print("[*] Navigating to Reddit...")
        page.goto("https://www.reddit.com/login")
        
        print("\n" + "="*50)
        print("[!] ACTION REQUIRED: Please log in using the browser window.")
        print("[!] Once you are fully logged in and see the Reddit homepage,")
        input("[!] Press ENTER in this terminal to save the session... ")
        print("="*50 + "\n")
        
        # Extract cookies and save to file
        context.storage_state(path="reddit_state.json")
        print("[+] SUCCESS: Session saved to reddit_state.json")
        
        browser.close()

if __name__ == "__main__":
    generate_state()