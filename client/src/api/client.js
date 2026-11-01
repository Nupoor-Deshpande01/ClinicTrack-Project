import axios from 'axios';

/**
 * One Axios instance for the whole app.
 * - baseURL: /api in dev (Vite proxies to Express); absolute when the client
 *   is deployed separately (set VITE_API_URL to the Render URL).
 * - request interceptor: attaches the JWT.
 * - response interceptor: a 401 on a protected call clears the session.
 */
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

// Increased to 60s to tolerate Render free-tier spin-up/cold starts (~30s).
const api = axios.create({ baseURL, timeout: 60000 });

// Token lives in localStorage so a refresh keeps the session.
export const TOKEN_KEY = 'clinictrack_token';
export const USER_KEY = 'clinictrack_user';

api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  error => {
    const status = error.response?.status;
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginCall) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // Full reload keeps all state consistent and bounces to /login.
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

/** Turn any Axios error into a readable message (+ per-field errors). */
export function errorMessage(error) {
  const data = error.response?.data;
  if (data?.errors?.length) return `${data.message}: ${data.errors.map(e => e.message).join('; ')}`;
  return data?.message || error.message || 'Something went wrong.';
}

export default api;
