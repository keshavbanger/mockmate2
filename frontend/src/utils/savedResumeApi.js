/**
 * Saved Resume API — upload a resume once, reuse it across every feature
 * that needs one (Mock Interview, Technical Interview Lab, ATS Checker,
 * Resume Builder import) instead of re-uploading the same file per feature.
 * See SavedResumeController on the backend.
 */

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const getToken = () => localStorage.getItem('token') || localStorage.getItem('mockmate_token') || '';

const handleResponse = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const listSavedResumes = () =>
  fetch(`${BASE}/api/resumes/saved`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  }).then(handleResponse);

export const getSavedResume = (id) =>
  fetch(`${BASE}/api/resumes/saved/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  }).then(handleResponse);

export const uploadSavedResume = (file, { label, setAsDefault } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  if (label) formData.append('label', label);
  if (setAsDefault) formData.append('setAsDefault', 'true');
  return fetch(`${BASE}/api/resumes/saved`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  }).then(handleResponse);
};

export const renameSavedResume = (id, label) =>
  fetch(`${BASE}/api/resumes/saved/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ label }),
  }).then(handleResponse);

export const setDefaultSavedResume = (id) =>
  fetch(`${BASE}/api/resumes/saved/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ setAsDefault: true }),
  }).then(handleResponse);

export const deleteSavedResume = (id) =>
  fetch(`${BASE}/api/resumes/saved/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  }).then(handleResponse);
