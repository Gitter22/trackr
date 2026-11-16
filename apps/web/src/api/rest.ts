import axios, { type AxiosInstance } from 'axios';
import type { TenantStorage } from '@/lib/storage';
import { TOKEN_KEY } from '@/lib/storage';

/** Control panel API: session lives in an httpOnly cookie on admin.<domain>. */
export const adminApi = axios.create({ baseURL: '/api/admin', withCredentials: true });

/** Tenant REST API: Bearer token from tenant-scoped storage. onUnauthorized fires on 401. */
export function createTenantApi(storage: TenantStorage, onUnauthorized: () => void): AxiosInstance {
  const api = axios.create({ baseURL: '/api/tenant' });
  api.interceptors.request.use((config) => {
    const token = storage.get(TOKEN_KEY);
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });
  api.interceptors.response.use(undefined, (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401 && !err.config?.url?.endsWith('/auth/login'))
      onUnauthorized();
    return Promise.reject(err);
  });
  return api;
}
