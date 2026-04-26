import os
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

async def test_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in .env")
        return

    print(f"Testing with API Key: {api_key[:10]}...")
    genai.configure(api_key=api_key)
    
    model_name = "gemini-flash-lite-latest"
    print(f"Testing model: {model_name}")
    
    try:
        model = genai.GenerativeModel(model_name)
        response = await model.generate_content_async("Hello, respond with 'OK' if you can hear me.")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error with {model_name}: {e}")
        
        # Try fallback
        fallback_model = "gemini-1.5-flash"
        print(f"Testing fallback model: {fallback_model}")
        try:
            model = genai.GenerativeModel(fallback_model)
            response = await model.generate_content_async("Hello, respond with 'OK' if you can hear me.")
            print(f"Response: {response.text}")
        except Exception as e2:
            print(f"Error with {fallback_model}: {e2}")

if __name__ == "__main__":
    asyncio.run(test_gemini())
