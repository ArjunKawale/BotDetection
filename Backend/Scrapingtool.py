import argparse
import json
import os
import sys

# Import your existing functions
from webScraperfn import scrape_and_save_user_data
from ConvText import (
    extract_messages_from_file,
    extract_posting_frequency,
    extract_rhythm_features,
)

def process_reddit_user(username):
    print(f"[*] Starting scrape for user: {username}")
    
    try:
        # 1. Scrape the raw data
        raw_file_path = scrape_and_save_user_data(username)
        
        if not os.path.exists(raw_file_path):
            print(f"[!] Error: Raw data file for {username} was not created.")
            sys.exit(1)
            
        print(f"[*] Raw data saved to {raw_file_path}. Formatting now...")

        # 2. Extract and format the specific features
        user_messages = extract_messages_from_file(raw_file_path)
        freq_val = extract_posting_frequency(raw_file_path)
        rhythm_dict = extract_rhythm_features(raw_file_path)

        # 3. Compile the formatted data
        formatted_data = {
            "username": username,
            "messages": user_messages,
            "frequency_data": freq_val,
            "rhythm_features": rhythm_dict
        }

        # 4. Save the cleanly formatted data
        # 4. Save the cleanly formatted data
        
        # Create the directory if it doesn't exist
        os.makedirs("UserData", exist_ok=True) 
        
        output_file = os.path.join("UserData", f"formatted_{username}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(formatted_data, f, indent=4)

        print(f"[+] Success! Formatted data saved to: {output_file}")

    except Exception as e:
        print(f"[!] An error occurred during processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Setup argument parsing so it can be run from the command line
    parser = argparse.ArgumentParser(description="Scrape and format Reddit user data.")
    parser.add_argument("username", help="The exact Reddit username to scrape")
    
    args = parser.parse_args()
    process_reddit_user(args.username)