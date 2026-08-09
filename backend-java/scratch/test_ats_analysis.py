import requests
import json
import sys
import time

BASE_URL = "http://localhost:8080/api"
PDF_PATH = r"c:\Users\bange\OneDrive\Desktop\keiyeta 2\test-assets\sample-resume.pdf"
JD = "Java Developer with strong knowledge of Spring Boot, REST APIs, PostgreSQL, Hibernate, microservices, and JUnit testing."

def run_test():
    # Step 1: Sign up a unique user to get a fresh token
    email = f"testuser_{int(time.time())}@example.com"
    password = "Password123"
    
    print(f"Registering user {email}...")
    signup_url = f"{BASE_URL}/auth/signup"
    signup_data = {
        "email": email,
        "password": password,
        "firstName": "Test",
        "lastName": "User",
        "username": f"user_{int(time.time())}"
    }
    resp = requests.post(signup_url, json=signup_data)
    token = None
    if resp.status_code == 200:
        res_json = resp.json()
        print("Signup successful:", res_json)
        token = res_json.get("accessToken")
    else:
        print(f"Signup failed: {resp.text}")
        return
            
    if not token:
        print("Failed to obtain authentication token.")
        return

    # Step 2: Upload resume for analysis
    upload_url = f"{BASE_URL}/ats/analyze"
    print(f"Uploading {PDF_PATH} to {upload_url}...")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        with open(PDF_PATH, "rb") as f:
            files = {"file": ("sample-resume.pdf", f, "application/pdf")}
            data = {"jdText": JD}
            resp = requests.post(upload_url, files=files, data=data, headers=headers)
            
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            print("Successfully received ATS Report!")
            print("Final Score:", result.get("finalScore"))
            print("Verdict:", result.get("verdict"))
            print("Verdict Reason:", result.get("verdictReason"))
            print("Bullet Rewrites count:", len(result.get("bulletRewrites", [])))
            print("Quantification Suggestions count:", len(result.get("quantificationSuggestions", [])))
            
            print("\nBullet Rewrites:")
            for i, rewrite in enumerate(result.get("bulletRewrites", [])):
                print(f"  {i+1}. Original: {rewrite.get('original')}")
                print(f"     Rewritten: {rewrite.get('rewritten')}")
                print(f"     Improvements: {rewrite.get('improvements')}")
                print(f"     Keywords Added: {rewrite.get('keywordsAdded')}")
                
            print("\nQuantification Suggestions:")
            for i, suggestion in enumerate(result.get("quantificationSuggestions", [])):
                print(f"  {i+1}. Original: {suggestion.get('original')}")
                print(f"     Suggestion: {suggestion.get('suggestion')}")
        else:
            print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Exception occurred: {e}")

if __name__ == "__main__":
    run_test()
