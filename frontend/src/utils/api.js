import axios from 'axios';

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  url = url.replace(/\/$/, '');
  if (!url.endsWith('/api')) url = `${url}/api`;
  return url;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Session ----------
export const createSession = () => api.post('/session/create');
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

// ============================================================
// ATS Resume Checker
// ============================================================
const getToken = () => localStorage.getItem('mockmate_token') || '';

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

export default api;
