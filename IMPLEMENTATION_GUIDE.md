# Interview Recording and Analysis Implementation Guide

This document describes the implementation of video recording, transcript generation, and filler word analysis features for the AI Interview Platform.

## Overview

The interview platform now supports:
1. **Live Video Recording** - Records candidate's camera and microphone during interview
2. **Transcript Generation** - Generates transcript from Tavus webhook data
3. **Filler Word Detection** - Detects filler words with timestamp mapping
4. **Timeline Visualization** - Shows filler words on interactive timeline in dashboard

## Architecture

### Frontend (React/Vite)

#### Video Recording Flow
```
InterviewRoom Component
  ├─ SetupPage: Sets interview status to 'active'
  └─ CandidatePanel: 
      ├─ Initializes VideoRecorder
      ├─ Listens to interview status change
      ├─ Starts recording when status='active'
      ├─ Stops and uploads when status='completed'
      └─ Updates context with recording path
```

#### Real-time Emotion & Filler Detection
```
CandidatePanel
  ├─ MediaPipe FaceLandmarker for emotion detection
  ├─ Real-time transcript mirroring from Tavus
  ├─ Filler word counting using fillerWords utility
  └─ Updates context with metrics every 500ms-5s
```

### Backend (FastAPI/Python)

#### Recording Storage & Processing
```
routes/recording.py
  ├─ POST /api/upload-recording
  │   ├─ Saves video file to backend/uploads/
  │   ├─ Stores metadata in session
  │   └─ Queues async processing
  └─ GET /api/recording/{session_id}
      └─ Returns recording metadata & analysis

transcript_processor.py
  ├─ Uses existing Tavus webhook transcript data
  ├─ Falls back to audio extraction (requires ffmpeg)
  └─ Generates timestamp-mapped filler analysis
```

#### Report Generation
```
report_generator.py
  ├─ Imports filler_detective.get_filler_timeline()
  ├─ Generates timeline events with timestamps
  ├─ Includes filler_timeline in final report
  └─ Frontend visualizes on interactive chart
```

## File Changes Summary

### New Files Created
- `frontend/src/utils/videoRecorder.js` - MediaRecorder wrapper
- `backend/routes/recording.py` - Recording upload & retrieval endpoints
- `backend/transcript_processor.py` - Transcript generation & processing
- `backend/uploads/` - Directory for video storage

### Modified Files

#### Frontend
1. **src/components/CandidatePanel.jsx**
   - Added `VideoRecorder` import
   - Added recording state management
   - Added lifecycle management (start/stop recording)
   - Added async upload function

2. **src/context/InterviewContext.jsx**
   - Added `status` field to sessionMetrics
   - Added `recordingPath` field to sessionMetrics
   - Added action types: `SET_STATUS`, `SET_RECORDING_UPLOADED`
   - Added action creators: `setStatus()`, `setRecordingUploaded()`

3. **src/pages/SetupPage.jsx**
   - Added `ctx.setStatus('active')` when interview starts

4. **src/pages/InterviewRoom.jsx**
   - Added `ctx.setStatus('completed')` when interview ends

5. **src/pages/ReportPage.jsx**
   - Added `FillerTimeline` component with interactive visualization
   - Added section rendering for filler timeline when data available

#### Backend
1. **main.py**
   - Added import for `recording_router`
   - Registered `/api` routes under "Recording" tag

2. **filler_detector.py**
   - Added `detect_fillers_with_timestamps(turns)` function
   - Added `get_filler_timeline(filler_analysis)` function

3. **report_generator.py**
   - Added imports for new filler detector functions
   - Updated `_assemble_report()` to include:
     - `filler_timeline` - Chronologically sorted events
     - `filler_analysis` - Detailed filler breakdown by word

4. **.env.example**
   - Added `MAX_RECORDING_SIZE_MB` configuration
   - Added `RECORDINGS_DIR` configuration
   - Added `TRANSCRIPTION_SERVICE` configuration

## Data Flow

### Recording Upload Flow
```
1. Interview starts
   └─ CandidatePanel detects status='active'
   └─ VideoRecorder.start() initiates MediaRecorder
   └─ Records video + audio in browser memory

2. Interview ends
   └─ CandidatePanel detects status='completed'
   └─ VideoRecorder.stop() returns Blob
   └─ uploadRecordingToServer(blob, sessionId)
   └─ FormData posted to /api/upload-recording
   └─ Backend saves to backend/uploads/interview_{sessionId}_{ts}.webm
   └─ Returns file_path to frontend
   └─ Frontend updates context with recordingPath

3. Report generation
   └─ Backend fetches session turns (from Tavus webhook)
   └─ Uses existing transcript + turns with timestamps
   └─ Generates filler timeline via detect_fillers_with_timestamps()
   └─ Sorts by timestamp
   └─ Includes in report.filler_timeline
```

### Filler Detection Pipeline
```
Session Data
  └─ turns[]: [
       {
         "role": "candidate",
         "text": "um, like, I think...",
         "timestamp_ms": 5000,
         "question_index": 0
       },
       ...
     ]

detect_fillers_with_timestamps(turns)
  └─ Matches FILLER_WORDS against each turn's text
  └─ Records occurrence with timestamp_ms and role
  └─ Returns: {
       "um": {
         "count": 3,
         "occurrences": [
           { "timestamp_ms": 5000, "turn_index": 0, "role": "candidate" }
         ]
       }
     }

get_filler_timeline(filler_analysis)
  └─ Converts to chronological timeline
  └─ Sorts by timestamp_ms
  └─ Returns: [
       {
         "timestamp_ms": 5000,
         "word": "um",
         "count": 1,
         "role": "candidate",
         "turn_index": 0
       },
       ...
     ]

Report includes filler_timeline
  └─ Frontend visualizes on interactive timeline chart
  └─ Shows word, count, timestamp, and legend
```

## Frontend Components

### VideoRecorder Class
```javascript
class VideoRecorder {
  async start()           // Starts recording
  async stop()            // Returns { blob, duration, mimeType }
  getSupportedMimeType()  // Detects browser support
  getIsRecording()        // Current recording state
  getDuration()           // Current duration in ms
}
```

### FillerTimeline Component
```jsx
<FillerTimeline
  fillerTimeline={report.filler_timeline}
  durationSeconds={report.duration_seconds}
/>
```

Features:
- Horizontal timeline bar with timestamp markers
- Clickable events showing filler word details
- Color-coded by word with legend
- Responsive to hover/interaction
- Shows time markers at 25%, 50%, 75% intervals

## Report Schema

### report.filler_timeline
```javascript
[
  {
    "timestamp_ms": 5000,      // When filler occurred
    "word": "um",              // The filler word
    "count": 1,                // How many times in that turn
    "role": "candidate",       // Who said it
    "turn_index": 0            // Which turn (for reference)
  }
]
```

### report.filler_analysis
```javascript
{
  "um": {
    "count": 3,
    "occurrences": [
      {
        "timestamp_ms": 5000,
        "turn_index": 0,
        "role": "candidate",
        "count_in_turn": 1
      }
    ]
  }
}
```

## Backend Recording Storage

Recordings are saved to:
```
backend/uploads/interview_{sessionId}_{timestamp}.webm
```

### Metadata Stored in Session
```python
recording = {
    "file_path": str,
    "file_name": str,
    "file_size": int,
    "mime_type": str,
    "uploaded_at": float,
    "upload_timestamp_ms": int
}
```

## Environment Variables

Add to `.env` file:
```bash
# Recording configuration
MAX_RECORDING_SIZE_MB=500
RECORDINGS_DIR=./uploads

# Transcript service (optional for future speech-to-text)
TRANSCRIPTION_SERVICE=none
# Options: none, google, assemblyai, deepgram
```

## Integration with Tavus Webhook

The transcript is automatically populated from Tavus webhook callbacks:
1. Frontend doesn't need to send transcript to backend
2. Tavus sends `participant.transcript` events with `timestamp_ms`
3. These are stored in `session.turns` with role, text, timestamp
4. Filler analysis extracts timestamps from these turns

## Future Enhancements

1. **Speech-to-Text Integration**
   - Implement AssemblyAI or Google Cloud Speech-to-Text
   - Extract audio from WebM videos
   - Generate transcripts with word-level timestamps

2. **Advanced Timeline Features**
   - Click timeline to jump to video playback (requires storing video URL)
   - Word-frequency heatmap
   - Statistical analysis by interview segment

3. **Persistent Storage**
   - Move from in-memory to database
   - Archive recordings with TTL
   - Enable historical interview comparisons

4. **Analytics**
   - Track filler word improvements over time
   - Compare against baseline metrics
   - Generate growth reports

## Testing

### Frontend Recording Test
```javascript
// In browser console during interview
const recorder = new VideoRecorder();
await recorder.start();
// ... wait for interview
const { blob } = await recorder.stop();
console.log('Recording size:', blob.size);
```

### Backend Upload Test
```bash
curl -X POST http://localhost:8000/api/upload-recording \
  -F "file=@sample.webm" \
  -F "session_id=test-session-123" \
  -F "timestamp_ms=1234567890"
```

### Check Recording Files
```bash
ls -lah backend/uploads/
# Should show: interview_test-session-123_1234567890.webm
```

## Troubleshooting

### Recording not starting
- Check browser console for MediaRecorder errors
- Ensure camera/microphone permissions granted
- Verify browser supports WebM codec

### Upload failing
- Check network tab for 413 (too large) errors
- Check file size < MAX_RECORDING_SIZE_MB
- Verify backend uploads directory is writable

### Filler timeline not showing
- Ensure Tavus webhook is firing and populating turns
- Check session.turns has "timestamp_ms" field
- Verify report generation includes turns data

### Missing timestamps in report
- Confirm Tavus webhook includes timestamp_ms in payload
- Check session data is persisting correctly
- Ensure turns are being saved with timestamps

## Performance Notes

- VideoRecorder uses in-memory chunking (can be memory-intensive for long interviews)
- Large video files (>500MB) need backend storage optimization
- Frontend emotion detection runs at 500ms intervals (configurable in DETECT_MS)
- Transcript generation is O(turns × fillers) complexity

## Security Considerations

- Implement file size validation (MAX_RECORDING_SIZE_MB)
- Add spam protection for upload endpoint
- Consider encryption for stored recordings
- Implement proper file cleanup on session expiry
- Add authentication/authorization to recording endpoints

## License

Same as main project
