import os
from dotenv import load_dotenv
from google import genai

# 1. Load environment variables
load_dotenv()
api_key = os.getenv("API")

# 2. Basic pre-flight check
if not api_key:
    print("❌ API Key missing: Ensure your .env file has API='your_key_here'")
else:
    # 3. Initialize the client
    client = genai.Client(api_key=api_key)

    try:
        # 4. Attempt a simple generation to verify the key
        print("Checking API key connectivity...")
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite", 
            contents="Say 'API Connection Successful!'"
        )
        
        # 5. Print the result
        print(f"✅ Success! Response: {response.text}")

    except Exception as e:
        # Catching auth errors or connection issues
        print(f"❌ API Check Failed: {e}")