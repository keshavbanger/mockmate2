# Report Generation Troubleshooting Guide

## Overview

The report generation pipeline depends on collecting real data during the interview:

1. **Questions** are generated based on resume
2. **Turns** (transcript) are captured from Tavus webhook
3. **Emotion Snapshots** are collected from facial analysis
4. **Report** is generated using all this data

If reports are generic/mocked, something in this chain is missing data.

---

## Quick Diagnosis

### Step 1: Check What Data Was Collected

**In Browser Development Console:**

```javascript
import { getSessionDiagnostics, printDiagnostics, isSessionReadyForReport } from '@/utils/diagnostics.js';

// Get diagnostics
const diag = await getSessionDiagnostics('your-session-id');

// Pretty print results
printDiagnostics(diag);

// Check if ready for report
const readiness = isSessionReadyForReport(diag);
console.log('Ready for report?', readiness.ready);
console.log('Issues:', readiness.issues);
```

### Step 2: Identify Missing Data

The diagnostics output will show which data is missing:

```
❌ Resume not uploaded
❌ No questions generated
❌ No transcript turns recorded (Tavus webhook may not have fired)
⚠️ No candidate answers recorded
⚠️ No emotion snapshots collected
```

### Step 3: Fix the Issue

Based on diagnostics, follow the corresponding fix below.

---

## Issue-Specific Fixes

### Issue 1: Questions Not Generated

**Problem**: `questions_count = 0`

**Cause**: `/generate-questions` endpoint not called

**Fix**: 
1. Go to Setup Page
2. Upload resume
3. Verify interview type/difficulty selected
4. Click "Generate Questions" button
5. Should see 7 questions listed

**Verify**: Run diagnostics again, should show `questions_count = 7`

---

### Issue 2: No Transcript Turns (Most Common)

**Problem**: `turns_count = 0` or `candidate_turns = 0`

**Cause**: Tavus webhook not firing OR not configured properly

**Debug Steps**:

1. **Check backend logs for webhook events**:
   ```
   grep "Transcript appended" backend.log
   grep "Tavus webhook event" backend.log
   ```

2. **If no webhook events**:
   - Tavus API key may be invalid
   - Webhook URL may not be configured in Tavus dashboard
   - Tavus conversation may not be created properly

3. **Verify Tavus is running**:
   - Check if conversation opens in interview
   - Watch for avatar speaking
   - If avatar appears but no speech, Tavus may be in mock mode

4. **Test with synthetic data** (see dev endpoints below)

---

### Issue 3: No Emotion Snapshots

**Problem**: `emotion_snapshots_count = 0`

**Cause**: 
- Emotion snapshots not being collected from facial analysis
- Emotion snapshots not being synced to backend

**Debug Steps**:

1. **Check if facial analysis is working**:
   - During interview, see emotion label on video?
   - See confidence bar moving?
   - If no, MediaPipe may not be loaded

2. **Check console for sync logs**:
   ```javascript
   // During interview, should see:
   // [EmotionSync] Sent X snapshots to backend
   ```

3. **If logs show sent but backend doesn't have**:
   - API call may be failing
   - Check network tab in DevTools
   - Verify `/api/save-emotion-snapshots` endpoint is working

---

## Test the Entire Pipeline

### Using Development Tools

**In development mode only**, you can inject synthetic data to verify the report generation pipeline works:

```javascript
import { quickTestReportPipeline } from '@/utils/devTools.js';

// One-command test (injects data + generates report)
const report = await quickTestReportPipeline('your-session-id');

// If successful, console will show:
// ✅ Test data injected
// ✅ Executive summary: ...
// ✅ Question feedback: 7 questions analyzed
// ✅ Scores: { overall: X, communication: X, ... }
// ✅ Report pipeline working correctly!
```

### Manual Test Steps

1. **Create new session**
2. **Upload resume**
3. **Generate questions** - verify 7 appear
4. **Start interview** - start talking (even just reading questions)
5. **Let run for 10+ seconds** to collect data
6. **End interview**
7. **Check diagnostics**:
   ```javascript
   const diag = await getSessionDiagnostics(sessionId);
   printDiagnostics(diag);
   ```
8. **Expected results**:
   - questions_count: 7
   - turns_count: > 10
   - candidate_turns: > 5
   - emotion_snapshots_count: > 20

---

## Understanding the Data Flow

### Interview Session → Report

```
1. Session Created
   └─ session_id generated
   
2. Resume Uploaded & Parsed
   └─ resume_data saved in session
   
3. Questions Generated
   └─ 7 questions saved in session.questions[]
   
4. Interview Started
   └─ Tavus persona created
   └─ Tavus conversation started
   └─ session.tavus_conversation_id set
   
5. During Interview (Real-time)
   ├─ Tavus avatar asks questions
   ├─ Candidate responds
   ├─ Tavus sends transcript via webhook
   │  └─ turns appended to session.turns[]
   ├─ Facial analysis detects emotions every 500ms
   ├─ Emotion snapshots collected
   └─ Every 5 seconds: emotion snapshots synced to backend
   
6. Interview Ends
   ├─ Tavus conversation ended
   ├─ Session marked "completed"
   └─ Any remaining emotion snapshots sent to backend
   
7. Report Generation
   ├─ Backend receives: questions, turns, emotion_snapshots
   ├─ Transcript built from turns
   ├─ Filler words detected
   ├─ Emotion analysis computed
   ├─ Gemini called with real data
   └─ Report returned with real insights
   
8. Report Displayed
   └─ Uses actual metrics from interview
```

---

## Backend Data Validation

**Endpoint**: `GET /api/session/{session_id}/diagnostics`

**Response shows**:

```json
{
  "session_id": "...",
  "status": "completed",
  "data_status": {
    "resume_uploaded": true,
    "candidate_name": "John Doe",
    "questions_count": 7,
    "turns_count": 45,
    "interviewer_turns": 7,
    "candidate_turns": 38,
    "emotion_snapshots_count": 234,
    "interview_duration_seconds": 480
  },
  "data_quality": {
    "issues": ["✅ Session data looks complete"],
    "ready_for_report": true
  }
}
```

---

## Common Solutions

### Reports Are Generic

**Check diagnostics - most likely cause**:

1. `turns_count = 0` → Tavus webhook not working
2. `candidate_turns = 0` → Interview ran but candidate didn't answer
3. `emotion_snapshots_count = 0` → Facial analysis not working
4. All zero → Run dev test to verify report system works

### Reports Crash During Generation

**Logs will show error**. Common causes:

1. No questions - Fixed: graceful handling
2. No turns - Fixed: graceful handling
3. Invalid Gemini response - Check Gemini API key
4. Missing emotion data - Fixed: graceful handling

### Tavus Avtar Starts But No Conversation

**Check**:
- Tavus API key in `.env`
- Webhook URL configured in Tavus dashboard
- Network connectivity to Tavus API

---

## Development Mode

### Enable Debug Logging

```python
# In backend .env
LOG_LEVEL=DEBUG
```

### Check Backend Logs

```bash
# Watch for key events
grep "Tavus webhook event" backend.log
grep "Transcript appended" backend.log  
grep "Report generated" backend.log
```

### Inject Test Data Directly

```bash
curl -X POST http://localhost:8000/api/dev/inject-test-data \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "your-session-id",
    "questions_count": 7,
    "answers_count": 7,
    "emotion_snapshots_count": 50
  }'
```

---

## Verification Checklist

- [ ] Questions are generated (7 appear on setup page)
- [ ] Interview starts successfully (avatar appears)
- [ ] Candidate speaks (avatar listens)
- [ ] Diagnostics show turns > 5 after interview
- [ ] Diagnostics show emotion_snapshots > 20
- [ ] Report generates without errors
- [ ] Report shows real questions asked
- [ ] Report shows actual candidate answers
- [ ] Report includes emotion analysis chart
- [ ] Report includes filler word detection
- [ ] Report scores match interview performance

---

## Getting Help

If issues persist:

1. **Collect diagnostics**:
   ```javascript
   const diag = await getSessionDiagnostics(sessionId);
   console.log(JSON.stringify(diag, null, 2));
   ```

2. **Copy from console and review for missing data**

3. **Check backend logs** for webhook events

4. **Try dev test**:
   ```javascript
   const report = await quickTestReportPipeline(sessionId);
   ```

5. **If dev test works but real interview doesn't**:
   - Issue is in Tavus integration, not report generation
   - Check Tavus webhook configuration
   - Verify Tavus API credentials
