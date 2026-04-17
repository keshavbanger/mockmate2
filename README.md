# 🎙️ InterviewBot — AI Mock Interview Platform

An end-to-end AI mock interview platform with resume parsing, live facial emotion analysis, filler-word detection, and a Gemini-generated performance report.

---

## ✨ Features

- **Resume Upload** — PDF parsed by PyMuPDF + structured by Gemini 1.5 Flash  
- **Tavus CVI** — AI interviewer avatar conducts a live WebRTC video interview  
- **MediaPipe FaceLandmarker** — Real-time emotion + gaze analysis in-browser (no video sent to server)  
- **Filler word detection** — Client-side live ticker + server-side authoritative counts  
- **Professional PDF report** — Gemini-generated narrative + Chart.js visualizations  

---

## 🔧 Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 or 3.12 |
| Node.js | 18+ (LTS recommended) |
| npm | 9+ |
| Docker + Docker Compose | Optional, for containerized run |

---

## 🔑 API Keys Required

### 1. Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key → `GEMINI_API_KEY`

### 2. Tavus API Key + Replica ID
1. Sign up at [tavus.io](https://www.tavus.io)
2. Go to **Settings → API Keys** → create a key → `TAVUS_API_KEY`
3. Go to **Replicas** in the Tavus dashboard
4. Select or create a replica → copy its ID (looks like `rf4e9d9790f0`) → `TAVUS_REPLICA_ID`

### 3. Sarvam AI API Key (optional TTS)
1. Sign up at [sarvam.ai](https://www.sarvam.ai)
2. Generate an API key → `SARVAM_API_KEY`

---

## 🚀 Setup & Run

### Step 1 — Clone & configure environment

```bash
git clone <your-repo-url>
cd ai-mock-interview

# Copy env template and fill in your keys
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
GEMINI_API_KEY=AIza...
TAVUS_API_KEY=tav_...
TAVUS_REPLICA_ID=rf4e9d9790f0
SARVAM_API_KEY=sk_...          # optional
BACKEND_URL=http://localhost:8000
```

### Step 2 — Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (with hot-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

### Step 3 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Frontend runs at: **http://localhost:5173** (or 5174 if 5173 is in use)

---

## 🐳 Docker Compose (Optional)

```bash
# From project root
cp backend/.env.example backend/.env
# Fill in .env

docker compose up --build
```

- Backend: http://localhost:8000  
- Frontend: http://localhost:5173

---

## 🗺️ Architecture

```
USER BROWSER (http://localhost:5173)
┌────────────────────────────────────────────────────────────┐
│  SetupPage                                                  │
│   ├─ PDF Upload → POST /api/parse-resume (PyMuPDF+Gemini)  │
│   └─ Config → POST /api/generate-questions (Gemini)        │
│              → POST /api/start-interview (Tavus)            │
│                                                            │
│  InterviewRoom                                              │
│   ├─ TavusAvatar <iframe>   (WebRTC — Tavus cloud)         │
│   │   └─ postMessage transcript events → useInterview ctx  │
│   └─ CandidatePanel                                        │
│       ├─ getUserMedia (webcam, audio=false)                 │
│       ├─ MediaPipe FaceLandmarker (WASM, CPU/GPU)          │
│       │   └─ emotion snapshots every 5s → context          │
│       └─ Filler word regex (client-side, real-time)        │
│                                                            │
│  End Interview flow:                                        │
│   POST /api/end-interview → 2s delay → POST /api/generate-report
│                                                            │
│  ReportPage                                                 │
│   ├─ Score cards (4× /10)                                  │
│   ├─ Chart.js: Bar (fillers) + Line (Q scores) + Pie (emo) │
│   ├─ Collapsible per-question breakdown (7×)               │
│   └─ window.print() → PDF                                  │
└────────────────────────────────────────────────────────────┘
           │  /api/* proxied to localhost:8000
           ▼
FASTAPI BACKEND (http://localhost:8000)
┌───────────────────────────────────────────┐
│  /api/parse-resume     PyMuPDF + Gemini   │
│  /api/generate-questions   Gemini 1.5 Flash│
│  /api/start-interview      Tavus CVI API  │
│  /api/save-turn            session_store  │
│  /api/end-interview        Tavus CVI API  │
│  /api/save-emotion-snapshots session_store│
│  /api/generate-report      Gemini + filler│
│  /api/tavus-webhook        event handler  │
│  /api/session/{id}         session_store  │
│  In-memory sessions · 2hr TTL · MVP only  │
└───────────────────────────────────────────┘
           │
           ▼
EXTERNAL SERVICES
  ┌──────────────────────┐  ┌──────────────────────┐
  │  Tavus CVI (WebRTC)  │  │ Google Gemini 1.5 Flash│
  │  AI avatar, STT,     │  │ Resume parse, questions│
  │  transcript events   │  │ report generation      │
  └──────────────────────┘  └──────────────────────┘
```

---

## 📁 Project Structure

```
ai-mock-interview/
├── backend/
│   ├── main.py               # FastAPI app, CORS, routes
│   ├── session_store.py      # In-memory sessions + TTL cleanup
│   ├── resume_parser.py      # PyMuPDF + Gemini extraction
│   ├── question_generator.py # Gemini question generation
│   ├── tavus_service.py      # Tavus API (persona + conversation)
│   ├── filler_detector.py    # Filler word count + answer quality
│   ├── report_generator.py   # Full report assembly via Gemini
│   ├── dependencies.py       # Gemini singleton dependency
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── routes/
│       ├── resume.py · questions.py · interview.py
│       ├── session.py · report.py · webhook.py
│
└── frontend/
    ├── src/
    │   ├── context/InterviewContext.jsx   # Global state (useReducer)
    │   ├── pages/SetupPage.jsx            # Upload + configure + start
    │   ├── pages/InterviewRoom.jsx        # Live interview UI
    │   ├── pages/ReportPage.jsx           # Charts + feedback
    │   ├── components/TavusAvatar.jsx     # Tavus iframe embed
    │   ├── components/CandidatePanel.jsx  # Webcam + MediaPipe
    │   ├── components/Toast.jsx           # Toast notifications
    │   └── utils/api.js · fillerWords.js
    ├── vite.config.js         # /api proxy → localhost:8000
    ├── tailwind.config.js
    └── package.json
```

---

## 🛑 Known Limitations (MVP)

- Sessions are **in-memory** — all data is lost on backend restart
- No authentication or user accounts
- MediaPipe requires a modern browser with WebAssembly support
- Tavus CVI `postMessage` transcript events depend on your Tavus plan tier

---

## 📄 License

MIT
