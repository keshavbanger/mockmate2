# Quick Start - Testing the New Interview Features

## Before You Start

1. Ensure your backend `.env` has:
   ```bash
   TAVUS_API_KEY=your_key
   GEMINI_API_KEY=your_key
   RECORDINGS_DIR=./uploads
   MAX_RECORDING_SIZE_MB=500
   ```

2. Create the uploads directory:
   ```bash
   mkdir -p backend/uploads
   chmod 755 backend/uploads
   ```

3. Restart backend server:
   ```bash
   cd backend
   python main.py
   ```

4. Frontend should already be running on http://localhost:5173

## Test Scenario

### Step 1: Start Interview
1. Navigate to http://localhost:5173
2. Upload a resume (or use existing)
3. Select interview type, difficulty, language
4. Click "Start Interview"
5. **Check browser console**: You should see:
   ```
   [VideoRecorder] Started recording
   ```

### Step 2: Interview Session
1. Answer a few questions (at least 2-3)
2. Speak naturally - try using some filler words like:
   - "um" or "uh"
   - "like"
   - "you know"
   - "basically"
   - "actually"
3. Don't rush - speak for at least 1-2 minutes total
4. **Watch the UI**:
   - "Fillers: X" badge updates in real-time
   - "Confidence" bar reflects emotion detection
   - "Live Transcript" shows what's being detected

### Step 3: End Interview
1. Click "End Interview" button
2. Confirm "End & Get Report"
3. Wait for report generation (15-30 seconds)
   - You should see progress stages:
     - "Ending interview session..."
     - "Processing transcript data..."
     - "Analysing your performance..."
     - "Generating your report ✨"

### Step 4: View Report
The report page will show several sections:

#### Performance Scores (top)
- Overall score
- Communication score
- Confidence score
- Technical score (if applicable)

#### Behavioral Analytics
Three charts showing:
1. **Filler Words** - Bar chart of detected fillers
2. **Answer Quality by Question** - Line chart of scores
3. **Emotion Distribution** - Pie chart

#### ⭐ NEW: Filler Word Analysis Timeline
This is the new interactive feature! You'll see:

```
┌─────────────────────────────────────────────┐
│ Filler Word Timeline                        │
├─────────────────────────────────────────────┤
│                                             │
│  [0:10] ●──────●──────●─────●───────● [5:30]│
│    um   like  you know basically      like  │
│                    [Hover/click for details]│
│                                             │
│  Time labels: 0:00 | 1:22 | 2:45 | 4:07   │
│                                             │
│  Legend:                                    │
│  🔵 "um" ×5      🟢 "like" ×3             │
│  🟡 "you know" ×2                          │
└─────────────────────────────────────────────┘
```

**Interactive Features:**
- Hover over event marker to see tooltip
- Shows word, count, exact timestamp
- Color-coded by word
- Legend shows all words and totals

### Step 5: Check Recording File
1. Open terminal
2. Navigate to backend directory:
   ```bash
   ls -lah uploads/
   ```
3. You should see:
   ```
   interview_[sessionId]_[timestamp].webm
   ```
4. Example:
   ```
   interview_abc123_1234567890.webm  (45.2 MB)
   ```

## What to Expect

### Real-time (During Interview)
✅ Video recording starts automatically
✅ Filler words counted and displayed
✅ Emotion detection updates every 5 seconds
✅ Live transcript appears in candidate panel
✅ WPM (words per minute) calculated and shown

### After Interview Ends
✅ Video automatically uploaded to backend/uploads/
✅ Transcript processed from Tavus webhook data
✅ Filler words analyzed with timestamps
✅ Report generated with all metrics
✅ Dashboard shows real interview data

### In Report
✅ Actual interview duration shown
✅ Real filler word counts and rate
✅ Emotion distribution based on facial analysis
✅ Per-question feedback with real scores
✅ Communication metrics (WPM, pauses, etc.)
✅ **NEW**: Interactive filler timeline visualization

## Expected Metrics

For a typical 5-minute interview:

**Communication**
- WPM: 100-150 (normal speaking pace)
- Filler count: 5-15 occurrences
- Pause count: 2-5 estimated pauses

**Emotion**
- Confident: 30-50%
- Neutral: 40-50%
- Nervous: 5-20%

**Performance**
- Overall score: 6-8/10 (for mock candidates)
- Communication: 6-8/10
- Confidence: 6-8/10
- Technical: 6-8/10 (if technical interview)

## Troubleshooting During Test

**Issue: "No fillers detected"**
→ This is normal if you spoke without using filler words
→ Try speaking more naturally, use "um" or "like" intentionally

**Issue: Recording file not created**
→ Check `backend/uploads/` directory exists and is writable
→ Check browser console for upload errors
→ Check backend logs for upload endpoint errors

**Issue: Timeline not showing in report**
→ Ensure interview was completed (not just stopped)
→ Check that at least one filler word was used
→ Wait for full report generation (can take 20-30s)

**Issue: Emotion data missing**
→ Camera must be working during interview
→ Face must be visible in webcam
→ MediaPipe model must load (check console for GPU/CPU fallback)

## File Locations to Check

```
Project Root
├── backend/
│   ├── uploads/                 ← Video files saved here
│   │   └── interview_*.webm
│   ├── filler_detector.py       ← Filler detection logic
│   ├── report_generator.py      ← Report with timeline
│   ├── transcript_processor.py  ← NEW: Transcript processing
│   └── routes/
│       └── recording.py         ← NEW: Upload endpoints
│
└── frontend/
    └── src/
        ├── utils/videoRecorder.js       ← NEW: Recording class
        └── pages/
            └── ReportPage.jsx           ← NEW: Timeline visualization
```

## Success Indicators

✅ After completing interview:
- Video file exists in `backend/uploads/`
- Report shows performance scores
- "Filler Word Analysis" section visible in report
- Timeline chart interactive and showing events
- Metrics match actual interview behavior

✅ Real data confirmation:
- WPM is realistic (not 1000+ or 0)
- Filler count matches spoken words
- Emotion distribution sums to 100%
- Timestamps in timeline are sequential
- Question feedback matches answers given

## Advanced Testing

### Manual Report Check
```bash
# Check session data in memory
curl http://localhost:8000/api/session/[sessionId]
```

### Check Recording Metadata
```bash
# In browser console after upload:
const res = await fetch('/api/recording/[sessionId]')
const data = await res.json()
console.log(data)
```

### Test Just the Endpoint
```bash
# Upload test video (if you have one)
curl -X POST http://localhost:8000/api/upload-recording \
  -F "file=@test.webm" \
  -F "session_id=test-123" \
  -F "timestamp_ms=1234567890"
```

## Performance Notes

- Small interviews (1-2 min): 10-20MB video
- Medium interviews (5 min): 30-50MB video
- Large interviews (10 min): 60-100MB video
- Upload time: Usually 5-15 seconds (depends on connection)

## Next: Customization

After confirming everything works:

1. **Adjust max file size**: Change `MAX_RECORDING_SIZE_MB` in `.env`
2. **Change storage path**: Modify `RECORDINGS_DIR` in `.env`
3. **Add more filler words**: Edit `FILLER_WORDS` in `filler_detector.py`
4. **Customize timeline colors**: Edit `getWordColor()` in `ReportPage.jsx`
5. **Tune emotion detection**: Adjust thresholds in `CandidatePanel.jsx`

---

**Questions or issues?**
Check `IMPLEMENTATION_GUIDE.md` for technical details and troubleshooting.
