import axios from 'axios';
import { useAuthStore } from './store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send cookies with cross-origin requests
});

// Intercepteur pour ajouter le token JWT + CSRF token
api.interceptors.request.use((config) => {
  // Bearer token (backward compat — cookies are preferred)
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // CSRF token from cookie (for mutating requests)
  if (typeof document !== 'undefined' && ['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
    const csrfCookie = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='));
    if (csrfCookie) {
      config.headers['X-CSRF-Token'] = csrfCookie.split('=')[1];
    }
  }

  return config;
});

// Intercepteur pour gérer les erreurs d'auth + refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle MFA required (403) — redirect to MFA setup (once, no loop)
    if (error.response?.status === 403 && error.response?.data?.mfaRequired && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith('/mfa') && !(window as any).__mfaRedirecting) {
        (window as any).__mfaRedirecting = true;
        window.location.replace('/mfa');
      }
      return Promise.reject(error);
    }

    // Try refresh token on 401 (if not already retrying)
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      const token = useAuthStore.getState().token;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (token && refreshToken) {
        originalRequest._retry = true;
        try {
          const refreshRes = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken },
            { withCredentials: true }
          );
          const { token: newToken, refreshToken: newRefreshToken, user } = refreshRes.data.data;
          useAuthStore.getState().login(newToken, user, newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — logout
          useAuthStore.getState().logout();
          window.location.href = '/connexion';
          return Promise.reject(error);
        }
      }

      if (token) {
        useAuthStore.getState().logout();
        window.location.href = '/connexion';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
