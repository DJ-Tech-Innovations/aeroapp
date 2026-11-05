import { http, HttpError } from '@/lib/http';

/** Learner API (same-origin session cookie, Sanctum SPA mode). */
export const api = {
    get: <T>(path: string) => http<T>(`/api${path}`),
    post: <T>(path: string, json?: unknown) => http<T>(`/api${path}`, { method: 'POST', json }),
    patch: <T>(path: string, json?: unknown) => http<T>(`/api${path}`, { method: 'PATCH', json }),
    del: <T>(path: string, json?: unknown) => http<T>(`/api${path}`, { method: 'DELETE', json }),
    upload: <T>(path: string, body: FormData) => http<T>(`/api${path}`, { method: 'POST', body }),
};
export const isAuthError = (e: unknown) => e instanceof HttpError && (e.status === 401 || e.status === 419);
export { HttpError };
