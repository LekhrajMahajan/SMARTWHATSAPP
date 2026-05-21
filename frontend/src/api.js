// src/api.js – Centralised API service layer
export const BASE_URL = import.meta.env.VITE_API_URL || '';

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

  const res = await fetch(`${BASE_URL}/upload`, {
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
  const res = await fetch(`${BASE_URL}/messages`, {
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
  window.open(`${BASE_URL}/download-sample`, '_blank');
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
  const res = await fetch(`${BASE_URL}/messages`, {
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
  const res = await fetch(`${BASE_URL}/status`, {
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

/**
 * POST /subscribe
 * Activate a subscription plan
 */
export async function subscribeToPlan(plan) {
  const res = await fetch(`${BASE_URL}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ plan }),
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Subscription failed: ${text}`);
  }

  return res.json();
}

/**
 * POST /api/payment/create-order
 * Create a new Razorpay order
 */
export async function createRazorpayOrder(plan) {
  const res = await fetch(`${BASE_URL}/api/payment/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ plan }),
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Order creation failed: ${text}`);
  }

  return res.json();
}

/**
 * POST /api/payment/verify
 * Verify Razorpay payment and activate subscription
 */
export async function verifyPayment(paymentDetails) {
  const res = await fetch(`${BASE_URL}/api/payment/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(paymentDetails),
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Payment verification failed: ${text}`);
  }

  return res.json();
}

/**
 * POST /api/campaign/stop
 * Stop an ongoing campaign
 */
export async function stopCampaign() {
  const res = await fetch(`${BASE_URL}/api/campaign/stop`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stop campaign failed: ${text}`);
  }

  return res.json();
}

