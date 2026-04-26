import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

def test_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in .env")
        return

    genai.configure(api_key=api_key)
    
    model_name = "gemini-flash-lite-latest"
    print(f"Testing model: {model_name}")
    
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hello, respond with 'OK' if you can hear me.")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_gemini()
