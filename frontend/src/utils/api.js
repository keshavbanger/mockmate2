import axios from 'axios';

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  url = url.replace(/\/$/, '');
  if (!url.endsWith('/api')) url = `${url}/api`;
  return url;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  // See AuthContext.jsx's api instance — measured Render cold-start time
  // for this backend is ~135s, not the ~50s Render's own docs suggest as a
  // general estimate. Matches that instance's timeout for consistency.
  timeout: 160000,
  headers: { 'Content-Type': 'application/json' },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('mockmate_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clear stale/invalid tokens on 401 so the app re-prompts for login instead of
// silently continuing to send a rejected token (this client has no other
// auth-state awareness, unlike the one in AuthContext).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('mockmate_token');
    }
    return Promise.reject(error);
  }
);

// ---------- Session ----------
export const createSession = (payload = {}) => api.post('/session/create', payload);
export const getSession    = (sessionId) => api.get(`/session/${sessionId}`);

// ---------- Resume ----------
export const parseResume = (file, sessionId) => {
  const form = new FormData();
  form.append('file', file);
  form.append('session_id', sessionId);
  return api.post('/parse-resume', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// ---------- Questions ----------
export const generateQuestions = (payload) => api.post('/generate-questions', payload);

// ---------- Interview ----------
export const startInterview  = (sessionId) => api.post('/start-interview', { session_id: sessionId });
export const saveTurn        = (sessionId, turnData) => api.post('/save-turn', { session_id: sessionId, turn_data: turnData });
export const sendMockChat    = (sessionId, userText) => api.post('/mock-chat', { session_id: sessionId, user_text: userText });
export const endInterview    = (sessionId, conversationId) => api.post('/end-interview', { session_id: sessionId, conversation_id: conversationId });

// ---------- Emotion ----------
export const saveEmotionSnapshots = (sessionId, snapshots) =>
  api.post('/save-emotion-snapshots', { session_id: sessionId, snapshots });

// ---------- Report ----------
export const generateReport = (sessionId) =>
  api.post('/generate-report', { session_id: sessionId }, { timeout: 120000 });

// ---------- History ----------
export const getInterviewHistory = (userId) =>
  api.get(`/interviews/history?userId=${userId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('mockmate_token')}` }
  });

// ---------- Dashboard ----------
export const getDashboardSummary = (userId) =>
  api.get(`/dashboard/summary?userId=${userId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('mockmate_token')}` }
  });

// ---------- Profile ----------
export const getUserProfile = () => api.get('/dashboard/profile');

// ============================================================
// ATS Resume Checker
// ============================================================
const getToken = () => localStorage.getItem('token') || localStorage.getItem('mockmate_token') || '';

/** Analyze a single resume against a job description */
export async function analyzeATS(file, jdText) {
  const form = new FormData();
  form.append('file', file);
  form.append('jdText', jdText);
  const res = await fetch(`${getBaseUrl()}/ats/analyze`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body:    form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Compare two resumes against a single job description */
export async function compareResumes(fileA, fileB, jdText) {
  const form = new FormData();
  form.append('fileA', fileA);
  form.append('fileB', fileB);
  form.append('jdText', jdText);
  const res = await fetch(`${getBaseUrl()}/ats/compare`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body:    form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Fetch an ATS report by ID */
export async function getATSReport(reportId) {
  const res = await fetch(`${getBaseUrl()}/ats/report/${reportId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Report not found (${res.status})`);
  return res.json();
}

/** Fetch ATS history for a user */
export async function getATSHistory(userId) {
  const res = await fetch(`${getBaseUrl()}/ats/history/${userId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  return res.json();
}

/** Download improved DOCX resume */
export async function downloadImprovedResume(reportId) {
  const res = await fetch(`${getBaseUrl()}/ats/report/${reportId}/download`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `improved_resume_${reportId.slice(0, 8)}.docx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ============================================================
// Resume HTML Generator
// ============================================================

/** Check confidence of parsed fields and get the resume data */
export async function getResumeConfidence(reportId, jd = '', template = 'classic') {
  const params = new URLSearchParams({ jd, template });
  const res = await fetch(`${getBaseUrl()}/resume-studio/confidence/${reportId}?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Confidence check failed (${res.status})`);
  return res.json(); // { confidence: {...}, resume: {...} }
}

/** Get HTML preview string (inline, for srcdoc iframe) */
export async function previewResumeHtml(resume, template = 'classic') {
  const res = await fetch(`${getBaseUrl()}/resume-studio/preview-html?template=${template}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(resume),
  });
  if (!res.ok) throw new Error(`Preview failed (${res.status})`);
  return res.json(); // { html: '...' }
}

/** Download HTML file */
export async function downloadResumeHtml(resume, template = 'classic') {
  const res = await fetch(`${getBaseUrl()}/resume-studio/generate-html?template=${template}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(resume),
  });
  if (!res.ok) throw new Error(`HTML download failed (${res.status})`);
  const blob = await res.blob();
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const name = (resume.name || 'resume').replace(/\s+/g, '_').toLowerCase();
  a.download = `${name}_resume.html`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/** Download LaTeX file */
export async function downloadResumeLatex(resume, template = 'classic') {
  const res = await fetch(`${getBaseUrl()}/resume-studio/generate-latex?template=${template}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(resume),
  });
  if (!res.ok) throw new Error(`LaTeX download failed (${res.status})`);
  const blob = await res.blob();
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const name = (resume.name || 'resume').replace(/\s+/g, '_').toLowerCase();
  a.download = `${name}_resume.tex`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ============================================================
// Resume Generator (Fill Gaps Wizard → writer pipeline) — a
// deliberately separate code path from resume-studio/reconstruction
// above: the writer never critiques, so it must never share a
// service/prompt with the AI-reconstruction or ATS-analysis engines.
// ============================================================

/** Parsed resume + gate result + skill suggestions, the wizard's starting point */
export async function getResumeGeneratorParsed(reportId) {
  const res = await fetch(`${getBaseUrl()}/resume-generator/parsed/${reportId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json(); // { resume, suggestedSkills, blockingFields }
}

/** Generate the final resume from a Fill-Gaps-Wizard-verified record */
export async function generateVerifiedResume(verified) {
  const res = await fetch(`${getBaseUrl()}/resume-generator/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(verified),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.violations = data.violations;
    throw err;
  }
  return data; // { resume, omittedFields, unresolvedPlaceholders }
}

/**
 * Switch template for a resume (zero AI, <1s).
 * Calls PUT /api/resume-studio/{resumeId}/template?templateId=...
 * Returns the DOCX bytes as a downloadable blob.
 */
export async function switchTemplate(resumeId, templateId) {
  const res = await fetch(
    `${getBaseUrl()}/resume-studio/${resumeId}/template?templateId=${templateId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Template switch failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const renderTime = res.headers.get('X-Render-Time-Ms');
  const atsScore = res.headers.get('X-ATS-Score');
  const blob = await res.blob();
  return { blob, renderTime, atsScore, templateId };
}

/** Save a candidate's audio turn for a question index */
export const saveAudioTurn = (sessionId, questionIndex, audioBlob) => {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('question_index', questionIndex);
  form.append('file', audioBlob, `audio_${questionIndex}.webm`);
  return api.post('/save-audio-turn', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// ---------- Technical Interview ----------

export const generateInterviewPlan = (formData) =>
  api.post('/tech-interview/plan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // plan generation can take up to 60s
  });

export const startTechInterview = (payload) =>
  api.post('/tech-interview/start', payload);

// Worst case per AIInterviewerService/OpenRouterFallbackService: 2 models x
// 2 attempts x up to 30s + fallback ~= up to ~211s, on top of any code/SQL
// execution this same call performs first. The shared axios instance's
// default (160s) is shorter than that worst case, so a legitimately slow
// (not hung) backend call could get aborted client-side while the backend
// keeps working and still persists the turn.
export const submitTechAnswer = (sessionId, payload) =>
  api.post(`/tech-interview/${sessionId}/answer`, payload, { timeout: 230000 });

// Backend grades test cases sequentially, each with its own 10s Piston
// timeout (CodeExecutionService) — a problem with more than one test case
// can legitimately take longer than the 15s this used to be capped at.
export const executeTechCode = (sessionId, payload) =>
  api.post(`/tech-interview/${sessionId}/execute-code`, payload, { timeout: 90000 });

export const executeTechSQL = (sessionId, payload) =>
  api.post(`/tech-interview/${sessionId}/execute-sql`, payload);

export const saveWhiteboard = (sessionId, snapshot) =>
  api.post(`/tech-interview/${sessionId}/save-whiteboard`, { snapshot });

export const endTechInterview = (sessionId) =>
  api.post(`/tech-interview/${sessionId}/end`, {}, { timeout: 60000 });

export const getTechInterviewReport = (sessionId) =>
  api.get(`/tech-interview/report/${sessionId}`);

export const getTechInterviewHistory = (userId) =>
  api.get(`/tech-interview/history/${userId}`);

export const getDsaProblem = (problemId) =>
  api.get(`/tech-interview/problems/dsa/${problemId}`);

export const getSqlProblem = (problemId) =>
  api.get(`/tech-interview/problems/sql/${problemId}`);

export default api;

