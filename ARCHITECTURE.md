# System Architecture - Interview Recording & Analysis

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             USER STARTS INTERVIEW                            │
│                         (SetupPage.jsx)                                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────┐
                    │  setStatus('active')       │
                    │  InterviewContext          │
                    └────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
    ┌──────────────────────────┐    ┌──────────────────────────┐
    │  CandidatePanel          │    │  InterviewRoom           │
    │  Detects status='active' │    │  Displays Tavus avatar   │
    └──────────────────────────┘    └──────────────────────────┘
                
                
                ▼
    ┌──────────────────────────┐
    │  VideoRecorder.start()   │
    │  - Request camera access │
    │  - Create MediaRecorder  │
    │  - Buffer audio chunks   │
    └──────────────────────────┘
                │
    ════════════════════════════════════════════════════════════════════════════
                        INTERVIEW IN PROGRESS (5-10 min)
    ════════════════════════════════════════════════════════════════════════════
                │
                ├─────────────────┬─────────────────┬──────────────────┐
                │                 │                 │                  │
                ▼                 ▼                 ▼                  ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Tavus Avatar │  │ Transcript   │  │ Emotion      │  │ Live Filler  │
        │ Asks Qs      │  │ Events come  │  │ Detection    │  │ Counting     │
        │              │  │ to webhook   │  │ (500ms)      │  │ (real-time)  │
        └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                │                 │                 │                  │
                │                 ▼                 ▼                  ▼
                │        ┌──────────────────────┐  ┌──────────────────────┐
                │        │ webhook.py           │  │ CandidatePanel       │
                │        │ Saves turns with:    │  │ - Count filler words │
                │        │ - text               │  │ - Update metrics     │
                │        │ - role               │  │ - Show in UI         │
                │        │ - timestamp_ms ✨    │  └──────────────────────┘
                │        └──────────────────────┘
                │                 │
                │                 ▼
                │        ┌──────────────────────┐
                │        │ session_store        │
                │        │ session.turns = [    │
                │        │   {                  │
                │        │    "text": "...",    │
                │        │    "role": "cand",   │
                │        │    "timestamp_ms": 5000 ✨
                │        │   },                 │
                │        │   ...                │
                │        │ ]                    │
                │        └──────────────────────┘
                │
                ├─ MediaRecorder buffers audio/video chunks
                │
    ════════════════════════════════════════════════════════════════════════════
                        USER CLICKS "END INTERVIEW"
    ════════════════════════════════════════════════════════════════════════════
                │
                ▼
    ┌──────────────────────────┐
    │  setStatus('completed')  │
    │  InterviewContext        │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ CandidatePanel detects   │
    │ status='completed'       │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ VideoRecorder.stop()     │
    │ Returns Blob with video  │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ uploadRecordingToServer()│
    │ FormData + fetch         │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ POST /api/upload-record  │
    │ (routes/recording.py)    │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────┐
    │ Save to disk                     │
    │ interview_{sessionId}_{ts}.webm  │
    │ ✨ Location: backend/uploads/    │
    └──────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ Update session:          │
    │ session.recording = {    │
    │   file_path: "...",      │
    │   file_size: 45234234,   │
    │   uploaded_at: 1234567   │
    │ }                        │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ Return response to FE    │
    │ with file_path           │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ ctx.setRecordingUploaded │
    │ (InterviewContext)       │
    │ sessionMetrics.          │
    │ recordingPath = "..."    │
    └──────────────────────────┘
                │
    ════════════════════════════════════════════════════════════════════════════
                      REPORT GENERATION (15-30 sec)
    ════════════════════════════════════════════════════════════════════════════
                │
                ▼
    ┌──────────────────────────┐
    │ User clicks "Get Report" │
    │ or auto after 2 sec     │
    └──────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ POST /api/generate-report            │
    │ (routes/report.py)                   │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ report_generator.generate_report()   │
    │ - Gets session.turns from memory     │
    │ - Builds full transcript             │
    │ - Counts filler words (basic)        │
    │ - Calculates WPM, pauses             │
    │ - Formats for Gemini                 │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ Call Gemini for narrative analysis   │
    │ (executive summary, scores, etc.)    │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ ✨ NEW FEATURE ✨                    │
    │ detect_fillers_with_timestamps()     │
    │ (filler_detector.py)                 │
    │                                      │
    │ Input: session.turns with            │
    │   - text                             │
    │   - role                             │
    │   - timestamp_ms ✨                  │
    │                                      │
    │ Process:                             │
    │ for each turn:                       │
    │   for each FILLER_WORD:              │
    │     if word in turn.text             │
    │       record {                       │
    │         timestamp_ms,                │
    │         word,                        │
    │         turn_index,                  │
    │         role                         │
    │       }                              │
    │                                      │
    │ Output: filler_analysis = {          │
    │   "um": {                            │
    │     count: 3,                        │
    │     occurrences: [                   │
    │       {timestamp_ms: 5000, ...},     │
    │       {timestamp_ms: 8500, ...},     │
    │       {timestamp_ms: 12000, ...}     │
    │     ]                                │
    │   },                                 │
    │   "like": { ... }                    │
    │ }                                    │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ ✨ NEW FEATURE ✨                    │
    │ get_filler_timeline()                │
    │ (filler_detector.py)                 │
    │                                      │
    │ Input: filler_analysis               │
    │                                      │
    │ Process:                             │
    │ Create chronological event list      │
    │ Sort by timestamp_ms                 │
    │                                      │
    │ Output: filler_timeline = [          │
    │   {                                  │
    │     "timestamp_ms": 5000,            │
    │     "word": "um",                    │
    │     "count": 1,                      │
    │     "role": "candidate",             │
    │     "turn_index": 0                  │
    │   },                                 │
    │   {                                  │
    │     "timestamp_ms": 8500,            │
    │     "word": "like",                  │
    │     "count": 1,                      │
    │     "role": "candidate",             │
    │     "turn_index": 2                  │
    │   },                                 │
    │   ...                                │
    │ ]                                    │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ _assemble_report()                   │
    │ Merge Gemini output + metrics        │
    │                                      │
    │ Final report includes:               │
    │ - executive_summary                  │
    │ - scores (communication, etc.)       │
    │ - question_feedback                  │
    │ - communication_metrics              │
    │ - emotion_data                       │
    │ - ✨ filler_timeline                 │
    │ - ✨ filler_analysis                 │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ Return complete report to frontend   │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ ctx.setReportData(report)            │
    │ InterviewContext                     │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ navigate('/report')                  │
    │ Show ReportPage                      │
    └──────────────────────────────────────┘
                │
    ════════════════════════════════════════════════════════════════════════════
                        USER VIEWS REPORT PAGE
    ════════════════════════════════════════════════════════════════════════════
                │
                ▼
    ┌──────────────────────────────────────┐
    │ ReportPage.jsx renders:              │
    │ - Score cards                         │
    │ - Executive summary                   │
    │ - Behavioral analytics charts         │
    │ - ✨ FillerTimeline component        │
    │ - Question breakdown                  │
    │ - Recommendations                     │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ ✨ NEW: Filler Timeline Chart        │
    │ (FillerTimeline component)           │
    │                                      │
    │ Input: report.filler_timeline        │
    │                                      │
    │ Renders:                             │
    │ - Horizontal timeline bar            │
    │   - Time scale: 0:00 - duration      │
    │   - Event markers (colored dots)     │
    │   - Hover tooltips                   │
    │   - Legend with word counts          │
    │                                      │
    │ Visualization:                       │
    │ ●──────●──────●─────●───────●       │
    │  um    like   you   basic    like    │
    │      (interactive)                   │
    └──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ User sees real interview data:       │
    │                                      │
    │ ✓ Actual video uploaded              │
    │ ✓ Real transcript with timestamps    │
    │ ✓ Filler words mapped to time        │
    │ ✓ Emotion data from facial analysis  │
    │ ✓ Real performance scores            │
    │ ✓ Actual WPM and metrics             │
    └──────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── Router
│   ├── SetupPage
│   │   ├── Interview Config Selection
│   │   └── Start Interview Button
│   │       └─ Sets status='active'
│   │
│   ├── InterviewRoom
│   │   ├── TavusAvatar (right)
│   │   │   └─ Tavus iframe (asks questions)
│   │   │
│   │   └── CandidatePanel (left)
│   │       ├─ VideoRecorder (recording)
│   │       ├─ Webcam Feed
│   │       │   ├─ Emotion Badge
│   │       │   └─ Confidence Bar
│   │       ├─ Live Transcript
│   │       └─ Filler Word Counter
│   │
│   └── ReportPage
│       ├─ Header (candidate info, scores)
│       ├─ Score Cards (4 metrics)
│       ├─ Executive Summary
│       ├─ Behavioral Analytics
│       │   ├─ Filler Words Bar Chart
│       │   ├─ Answer Quality Line Chart
│       │   └─ Emotion Pie Chart
│       ├─ ✨ NEW: FillerTimeline Component
│       │   ├─ Timeline Bar (interactive)
│       │   └─ Legend (word colors/counts)
│       ├─ Strengths/Improvements/Recommendations
│       └─ Per-Question Breakdown
```

## Data Structures

### Interview Context State
```javascript
{
  sessionId: "abc-123",
  sessionMetrics: {
    transcript: "Hello, um, I'm a software engineer...",
    fillerCounts: { "um": 3, "like": 2 },
    totalFillers: 5,
    wpm: 125,
    status: "completed",                      // ✨ NEW
    recordingPath: "/uploads/interview_*.webm", // ✨ NEW
    emotionSnapshots: [
      {
        timestamp_ms: 5000,
        emotions: { confident: 0.5, nervous: 0.2 },
        confidence_score: 0.65
      }
    ]
  }
}
```

### Session Data (Backend)
```python
{
  "session_id": "abc-123",
  "turns": [
    {
      "role": "candidate",
      "text": "Hello, I'm a software engineer with 5 years...",
      "timestamp_ms": 5000,         # ✨ From Tavus webhook
      "question_index": 0
    },
    {
      "role": "candidate",
      "text": "um, my favorite project was building...",
      "timestamp_ms": 8500,         # ✨ From Tavus webhook
      "question_index": 0
    }
  ],
  "recording": {
    "file_path": "backend/uploads/interview_abc123_1234567890.webm",
    "file_size": 45234234,
    "uploaded_at": 1234567890
  },
  "report": {
    "overall_score": 7,
    "filler_timeline": [          # ✨ NEW
      {
        "timestamp_ms": 8500,
        "word": "um",
        "count": 1,
        "role": "candidate",
        "turn_index": 1
      }
    ],
    "filler_analysis": {          # ✨ NEW
      "um": {
        "count": 3,
        "occurrences": [...]
      }
    }
  }
}
```

## Key Integration Points

### 1. Status Management
- `SetupPage.jsx` → `ctx.setStatus('active')` when interview starts
- `InterviewRoom.jsx` → `ctx.setStatus('completed')` when interview ends
- `CandidatePanel.jsx` → Listens to status changes to manage recording

### 2. Transcript with Timestamps
- `webhook.py` → Receives Tavus events with `timestamp_ms`
- Saves to `session.turns` with role, text, and timestamp
- No additional API calls needed

### 3. Filler Detection
- **Frontend**: Real-time counting in `CandidatePanel.jsx`
- **Backend**: Timestamp mapping in `report_generator.py`
- **Timeline**: Rendered by `FillerTimeline` component in `ReportPage.jsx`

### 4. Report Pipeline
```
session.turns (with timestamps)
  ↓
detect_fillers_with_timestamps()  ✨ NEW
  ↓
filler_analysis (word occurrences with timestamps)
  ↓
get_filler_timeline()  ✨ NEW
  ↓
filler_timeline (chronological events)
  ↓
Report includes both + renders in ReportPage
```

## File Persistence

```
backend/
├── uploads/
│   ├── interview_session1_1234567890.webm  (45 MB)
│   ├── interview_session2_1234567891.webm  (52 MB)
│   └── interview_session3_1234567892.webm  (38 MB)
└── session_store (in-memory)
    ├── session1: {"turns": [...], "recording": {...}}
    ├── session2: {"turns": [...], "recording": {...}}
    └── session3: {"turns": [...], "recording": {...}}
```

Session data keeps recording metadata and video files stay on disk.

---

**Key Innovation**: By using `timestamp_ms` from Tavus webhook events, we can precisely map detected fillers to their exact time in the interview, enabling accurate timeline visualization without requiring separate speech-to-text API integrations.
