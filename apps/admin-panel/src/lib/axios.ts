import axios from 'axios';
import { getToken, clearToken } from './token';

export const api = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 → clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
