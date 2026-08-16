/**
 * Resume Builder API utility.
 * All calls route through the Mockmate backend — API key never touches the client.
 */

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const getToken = () => localStorage.getItem('mockmate_token') || localStorage.getItem('token') || '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

const handleResponse = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return res.json();
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const fetchResumes = () =>
  fetch(`${BASE}/api/resumes`, { headers: authHeaders() }).then(handleResponse);

export const fetchResume = (id) =>
  fetch(`${BASE}/api/resumes/${id}`, { headers: authHeaders() }).then(handleResponse);

export const createResume = (body) =>
  fetch(`${BASE}/api/resumes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }).then(handleResponse);

export const updateResume = (id, body) =>
  fetch(`${BASE}/api/resumes/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }).then(handleResponse);

export const deleteResume = (id) =>
  fetch(`${BASE}/api/resumes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).then(handleResponse);

export const duplicateResume = (id) =>
  fetch(`${BASE}/api/resumes/${id}/duplicate`, {
    method: 'POST',
    headers: authHeaders(),
  }).then(handleResponse);

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * `source` is either { mode: 'upload', file, saveAsResume, label } or
 * { mode: 'saved', savedResumeId } — see ResumeSourcePicker. A plain File is
 * also accepted for back-compat.
 */
export const importResume = (source) => {
  const formData = new FormData();
  if (source?.mode === 'saved') {
    formData.append('savedResumeId', source.savedResumeId);
  } else {
    formData.append('file', source?.file ?? source);
    if (source?.saveAsResume) formData.append('saveAsResume', 'true');
    if (source?.label) formData.append('label', source.label);
  }
  return fetch(`${BASE}/api/resumes/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  }).then(handleResponse);
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const generateSummary = (payload) =>
  fetch(`${BASE}/api/ai/resume/summary`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  }).then(handleResponse);

export const improveBullet = (payload) =>
  fetch(`${BASE}/api/ai/resume/improve-bullet`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  }).then(handleResponse);

export const generateBullets = (payload) =>
  fetch(`${BASE}/api/ai/resume/generate-bullets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  }).then(handleResponse);
