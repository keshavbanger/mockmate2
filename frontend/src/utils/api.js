import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Session ----------
export const createSession = () => api.post('/session/create');
export const getSession = (sessionId) => api.get(`/session/${sessionId}`);

// ---------- Resume ----------
export const parseResume = (file, sessionId) => {
  const form = new FormData();
  form.append('file', file);
  form.append('session_id', sessionId);
  return api.post('/parse-resume', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ---------- Questions ----------
export const generateQuestions = (payload) => api.post('/generate-questions', payload);

// ---------- Interview ----------
export const startInterview = (sessionId) =>
  api.post('/start-interview', { session_id: sessionId });

export const saveTurn = (sessionId, turnData) =>
  api.post('/save-turn', { session_id: sessionId, turn_data: turnData });

export const sendMockChat = (sessionId, userText) =>
  api.post('/mock-chat', { session_id: sessionId, user_text: userText });

export const endInterview = (sessionId, conversationId) =>
  api.post('/end-interview', { session_id: sessionId, conversation_id: conversationId });

// ---------- Emotion ----------
export const saveEmotionSnapshots = (sessionId, snapshots) =>
  api.post('/save-emotion-snapshots', { session_id: sessionId, snapshots });

// ---------- Report ----------
export const generateReport = (sessionId) =>
  api.post('/generate-report', { session_id: sessionId });

export default api;
