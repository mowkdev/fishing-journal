import { apiFetch } from '@/shared/api/http';

export const loginRequest = (credentials) =>
  apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

export const logoutRequest = () => apiFetch('/auth/logout', { method: 'POST' });

export const meRequest = () => apiFetch('/auth/me');
