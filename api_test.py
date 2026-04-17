"""
Full end-to-end API integration test.
Tests every backend endpoint in the correct order with the sample PDF.
"""
import json, sys, time
import requests

BASE  = "http://localhost:8000/api"
PDF   = r"test-assets\sample-resume.pdf"
PASS  = []
FAIL  = []

def check(label, response, expected_keys=()):
    ok = response.status_code < 400
    data = {}
    try:
        data = response.json()
    except Exception:
        pass
    for k in expected_keys:
        if k not in (data if isinstance(data, dict) else {}):
            ok = False
    status = "PASS" if ok else "FAIL"
    (PASS if ok else FAIL).append(label)
    print(f"  [{status}] {label} ({response.status_code})")
    if not ok:
        print(f"         Body: {str(data)[:300]}")
    return data if ok else None

print("\n=== AI Mock Interview — API Integration Test ===\n")

# 1. Health
print("1. Health check")
r = requests.get("http://localhost:8000/health")
check("GET /health", r, ("status",))

# 2. Create session
print("2. Create session")
r = requests.post(f"{BASE}/session/create")
d = check("POST /session/create", r, ("session_id",))
if not d: sys.exit("FATAL: Cannot create session")
session_id = d["session_id"]
print(f"   session_id = {session_id}")

# 3. Parse resume
print("3. Parse resume (PDF upload)")
with open(PDF, "rb") as f:
    r = requests.post(
        f"{BASE}/parse-resume",
        files={"file": ("sample-resume.pdf", f, "application/pdf")},
        data={"session_id": session_id},
    )
d = check("POST /parse-resume", r, ("resume_data",))
if d:
    rd = d["resume_data"]
    print(f"   name={rd.get('name')}  skills={rd.get('skills', [])[:4]}")

# 4. Get session (verify resume stored)
print("4. Get session")
r = requests.get(f"{BASE}/session/{session_id}")
d = check("GET /session/{id}", r, ("session_id",))

# 5. Generate questions
print("5. Generate questions")
r = requests.post(f"{BASE}/generate-questions", json={
    "session_id":     session_id,
    "interview_type": "Behavioral",
    "difficulty":     "Mid",
    "language":       "English",
})
d = check("POST /generate-questions", r, ("questions",))
if d:
    qs = d["questions"]
    print(f"   Generated {len(qs)} questions")
    for i, q in enumerate(qs[:3], 1):
        print(f"   Q{i}: {q[:80]}...")

# 6. Start interview (Tavus mock)
print("6. Start interview (Tavus mock mode)")
r = requests.post(f"{BASE}/start-interview", json={"session_id": session_id})
d = check("POST /start-interview", r, ("conversation_url", "conversation_id"))
conv_id = None
if d:
    conv_id = d.get("conversation_id")
    print(f"   conversation_url = {d.get('conversation_url')}")
    print(f"   conversation_id  = {conv_id}")

# 7. Save emotion snapshots
print("7. Save emotion snapshots")
snapshots = [
    {"timestamp_ms": 5000,  "emotions": {"confident": 0.7, "nervous": 0.1, "neutral": 0.2},
     "gaze": "center", "confidence_score": 0.72},
    {"timestamp_ms": 10000, "emotions": {"confident": 0.5, "nervous": 0.3, "neutral": 0.2},
     "gaze": "away",   "confidence_score": 0.55},
    {"timestamp_ms": 15000, "emotions": {"confident": 0.8, "nervous": 0.05, "neutral": 0.15},
     "gaze": "center", "confidence_score": 0.80},
]
r = requests.post(f"{BASE}/save-emotion-snapshots", json={
    "session_id": session_id,
    "snapshots": snapshots,
})
check("POST /save-emotion-snapshots", r)

# 8. End interview
print("8. End interview")
r = requests.post(f"{BASE}/end-interview", json={
    "session_id":      session_id,
    "conversation_id": conv_id or "test-conv-123",
})
check("POST /end-interview", r)

# 9. Generate report
print("9. Generate report")
r = requests.post(f"{BASE}/generate-report", json={"session_id": session_id})
d = check("POST /generate-report", r, ("scores", "question_feedback"))
if d:
    print(f"   Overall score   = {d.get('scores', {}).get('overall')}")
    print(f"   Questions graded = {len(d.get('question_feedback', []))}")
    print(f"   Strengths        = {len(d.get('strengths', []))}")
    print(f"   Improvements     = {len(d.get('improvements', []))}")

print(f"\n=== RESULTS: {len(PASS)} passed / {len(FAIL)} failed ===")
if FAIL:
    print("FAILED:", FAIL)
    sys.exit(1)
else:
    print("ALL TESTS PASSED!")
