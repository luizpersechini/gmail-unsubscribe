const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch {
      // ignore
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  async getAppStatus() {
    return request('/api/status/app');
  },

  async getConfig() {
    return request('/api/status/config');
  },

  async getAuthUrl() {
    return request('/api/auth/url');
  },

  async startRun(options) {
    return request('/api/unsubscribe/start', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  async listRuns() {
    return request('/api/unsubscribe/runs');
  },

  async getRun(runId) {
    return request(`/api/unsubscribe/runs/${runId}`);
  },

  async getRunLogs(runId) {
    return request(`/api/unsubscribe/runs/${runId}/logs`);
  },

  async cancelRun(runId) {
    return request(`/api/unsubscribe/runs/${runId}/cancel`, {
      method: 'POST',
    });
  },
};
