const TOKEN_KEY = 'fishing-journal-auth-token';

export const getToken = () =>
  typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => window.localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, {
      status: res.status,
      body,
    });
  }

  return body;
};
