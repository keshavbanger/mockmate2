import requests
import os

BASE_URL = "http://localhost:8000/api"

def test_upload():
    # 1. Create session
    print("Creating session...")
    resp = requests.post(f"{BASE_URL}/session/create")
    if resp.status_code != 200:
        print(f"Failed to create session: {resp.text}")
        return
    
    session_id = resp.json()["session_id"]
    print(f"Session created: {session_id}")
    
    # 2. Upload resume
    pdf_path = "test-assets/sample-resume.pdf"
    print(f"Uploading {pdf_path}...")
    
    with open(pdf_path, "rb") as f:
        files = {"file": ("sample-resume.pdf", f, "application/pdf")}
        data = {"session_id": session_id}
        resp = requests.post(f"{BASE_URL}/parse-resume", files=files, data=data)
        
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    test_upload()
