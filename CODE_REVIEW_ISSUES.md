# Code Review Issues - AI Mock Interview Simulator

This document outlines technical issues, potential bugs, and architectural concerns identified during the code review.

## 1. Memory Management & Scalability

### [Backend] Memory-Intensive File Uploads
**File:** `backend/routes/recording.py`  
**Line:** 85-90  
**Issue:** The code uses `contents = await file.read()` which loads the entire video file into RAM. For 5-10 minute interviews (up to 500MB as per config), this can lead to **Out of Memory (OOM)** crashes on the server, especially with concurrent users.
**Recommendation:** Use a streaming approach with `shutil.copyfileobj(file.file, destination_file)`.

### [Frontend] In-Memory Video Buffering
**File:** `frontend/src/utils/videoRecorder.js`  
**Line:** 43-47  
**Issue:** All video chunks are pushed into the `recordedChunks` array in RAM. For high-resolution or long recordings, this may cause the browser tab to crash due to memory exhaustion.
**Recommendation:** For an MVP, this is common, but for production, consider periodical flushing or using a specialized library.

---

## 2. Security & Data Integrity

### [Backend] Path Traversal Potential
**File:** `backend/routes/recording.py`  
**Line:** 81-83  
**Issue:** While `session_id` is validated against the store, it is used directly in a generated filename. If any part of the file naming logic ever incorporates user-controlled strings, it could lead to directory traversal.
**Recommendation:** Use `os.path.basename` or ensure extreme sanitization of any variables used in file paths.

### [Backend] Lack of Rate Limiting
**File:** `backend/routes/resume.py` and `backend/routes/recording.py`  
**Issue:** There are no rate limits on expensive operations like PDF parsing or video uploads. This makes the backend vulnerable to Denial of Service (DoS) attacks.
**Recommendation:** Implement `slowapi` or similar middleware to limit requests per IP/User.

---

## 3. Reliability & LLM Handling

### [Backend] Brittle JSON Parsing
**File:** `backend/filler_detector.py`  
**Line:** 187-198  
**Issue:** The code manually strips markdown fences and uses `json.loads` on Gemini's output. If Gemini includes extra commentary or fails to provide valid JSON, the analysis fails silently with a fallback score.
**Recommendation:** Use Pydantic programs or structured output features provided by the Gemini API to guarantee schema compliance.

### [Backend] Duration Calculation Edge Case
**File:** `backend/report_generator_enhanced.py`  
**Line:** 143-144  
**Issue:** `end_time - start_time` assumes the clock has progressed correctly. While `max(0.0, ...)` is used, relying on wall-clock time can be problematic if the system clock syncs during an interview.
**Recommendation:** Use `time.monotonic()` for interval calculations instead of `time.time()`.

---

## 4. Concurrency & State

### [Backend] In-Memory State Non-Thread-Safe
**File:** `backend/session_store.py`  
**Line:** 18, 56-68  
**Issue:** `_sessions` is a plain Python dict. While FastAPI is async, Python's GIL protects simple dict operations, but more complex updates (read -> modify -> write) across multiple async tasks could lead to data loss or race conditions as the project scales.
**Recommendation:** Use a `Lock` for modifying the shared dictionary or move to a proper state store like Redis.

---

## 5. User Experience & Connectivity

### [Frontend] Missing Retry Logic for Uploads
**File:** `frontend/src/utils/videoRecorder.js`  
**Issue:** If the network flickers during the final video upload, the video is lost because it is only held in memory and the `stop()` process doesn't handle retries.
**Recommendation:** Implement a retry mechanism with exponential backoff for the upload fetch call.
