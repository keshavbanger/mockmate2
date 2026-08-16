/**
 * Admin panel API — user management (plan/role). See AdminController on the
 * backend; every call here is re-checked server-side regardless of what the
 * frontend shows, since role is only enforced client-side for UX.
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

export const listUsers = () =>
  fetch(`${BASE}/api/admin/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  }).then(handleResponse);

export const updateUserPlan = (id, planType) =>
  fetch(`${BASE}/api/admin/users/${id}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ planType }),
  }).then(handleResponse);

export const updateUserRole = (id, role) =>
  fetch(`${BASE}/api/admin/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ role }),
  }).then(handleResponse);
