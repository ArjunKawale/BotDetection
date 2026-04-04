import os
import json
from dotenv import load_dotenv
from google import genai

# Load env variables and initialize client globally
load_dotenv()
client = genai.Client(api_key=os.getenv("API"))

def build_analysis_prompt(user_data: dict) -> str:
    # No json.dumps() needed! We just drop the raw dictionary right into the f-string.
    prompt = f"""
You are analyzing Reddit posts/comments from ONE user account.

Input Data:
{user_data}

Analyze the messages collectively to detect patterns, intent, and likelihood of automation.

Tasks:

1. Identify whether the messages promote a repeated theme, narrative, ideology, or running joke.

2. Classify the primary content intent:
- spam (advertising, scams, promotion, link farming)
- propaganda (political or ideological narrative pushing)
- normal_discussion (general conversation across varied topics)
- running_bit (repeated joke, meme persona, or intentionally recurring theme)

3. Determine whether the account appears to be:
- human_user
- likely_bot

Important:
Spam or propaganda can be posted by both humans and bots.  
When estimating automation likelihood, focus on signals such as:
- repetitive or templated messages
- identical structure across posts
- lack of conversational engagement
- copy-paste style content
- systematic or mechanical tone.

4. Estimate the probability that the account is automated.

5. If likely_bot, classify the most probable bot type:
- spam_bot
- propaganda_bot
- karma_farming_bot
- engagement_bot
- unknown_bot

Return ONLY JSON in the following format:

{{
"content_classification": "spam | propaganda | normal_discussion | running_bit",
"account_type": "human_user | likely_bot",
"pattern_detected": true/false,
"pattern_description": "...",
"bot_probability": 0.0,
"bot_type": "spam_bot | propaganda_bot | karma_farming_bot | engagement_bot | unknown_bot",
"key_indicators": [
"indicator1",
"indicator2",
"indicator3"
]
}}
"""
    return prompt

def run_ideology_model(user_data: dict) -> dict:
    prompt = build_analysis_prompt(user_data)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        # Clean the response. Sometimes LLMs wrap JSON in markdown blockticks like ```json
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        return json.loads(raw_text.strip())
        
    except json.JSONDecodeError:
        return {"error": "Failed to parse LLM response into JSON", "bot_probability": 0.5}
    except Exception as e:
        return {"error": str(e), "bot_probability": 0.5}