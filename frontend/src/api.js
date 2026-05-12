// src/api.js – Centralised API service layer
const BASE_URL = import.meta.env.VITE_API_URL || '';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * POST /upload
 * Upload Excel file + message template → triggers WhatsApp send
 */
export async function uploadAndSend(file, message) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('message', message);

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    },
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * GET /messages
 * Fetch all sent message logs from the database
 */
export async function fetchMessageLogs() {
  const res = await fetch(`${BASE_URL}/api/messages`, {
    headers: getAuthHeaders()
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return [];
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch logs: ${res.status}`);
  }

  return res.json();
}

/**
 * GET /download-sample
 */
export function downloadSampleCSV() {
  window.open(`${BASE_URL}/api/download-sample`, '_blank');
}

/**
 * GET /api
 * Health check
 */
export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api`);
  return res.json();
}

/**
 * DELETE /api/messages
 * Clear all campaign logs
 */
export async function clearMessageLogs() {
  const res = await fetch(`${BASE_URL}/api/messages`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to clear logs');
  return res.json();
}

/**
 * GET /api/status
 * Fetch daily limits, cooldowns, and window state
 */
export async function getStatus() {
  const res = await fetch(`${BASE_URL}/api/status`, {
    headers: getAuthHeaders()
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch status: ${res.status}`);
  }

  return res.json();
}
