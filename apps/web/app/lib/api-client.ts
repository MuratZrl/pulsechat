import { disconnectSocket } from './socket-control';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const ACCESS_TOKEN_KEY = 'chat_access_token';
const REFRESH_TOKEN_KEY = 'chat_refresh_token';

// Single-flight refresh promise. The backend rotates refresh tokens with
// reuse detection: a second call with the now-stale token wipes every
// refresh row for the user and 401s. So when N requests 401 in parallel
// we MUST send exactly one /auth/refresh and have all of them await its
// result, instead of each one independently calling /auth/refresh.
let refreshPromise: Promise<boolean> | null = null;

// Endpoints that should NOT trigger auto-refresh or redirect on 401.
// These are unauthenticated by design — a 401 here is a normal "wrong
// credentials" / "invalid token" response and the caller handles it.
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

function isAuthEndpoint(path: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
}

// ─── Token helpers ─────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  const hadOldToken = !!localStorage.getItem(ACCESS_TOKEN_KEY);
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  // If we're replacing an existing token (refresh case, not initial login),
  // kick the socket so the next mount picks up the new token.
  if (hadOldToken) disconnectSocket();
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Refresh coordination ──────────────────────────────────────────────────

async function performRefresh(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshRes.ok) return false;
    const data = await refreshRes.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    // Network error, JSON parse error, anything — treat as a failed refresh
    // so the caller falls through to the logout path.
    return false;
  }
}

function getOrCreateRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  // The .finally() runs synchronously when the promise settles, BEFORE any
  // chained .then resumers fire (per spec). That ordering is what makes the
  // single-flight pattern correct: by the time awaiters wake up and decide
  // whether to retry, refreshPromise is already null, so the next 401 in a
  // future expiry window starts a fresh refresh instead of reusing this one.
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401 — but ONLY for authenticated endpoints.
  // For /auth/login, /auth/register, etc., a 401 means "wrong credentials"
  // and must be surfaced to the caller as a normal error, not a session
  // expiry that triggers redirect.
  if (res.status === 401 && retry && !isAuthEndpoint(path)) {
    const refreshed = await getOrCreateRefresh();
    if (refreshed) {
      // retry=false guards against an infinite loop if the retry itself 401s.
      return apiFetch<T>(path, options, false);
    }
    clearTokens();
    // Only redirect if we're NOT already on an auth page. Without this guard,
    // landing on /login with no token causes a hard reload loop that resets
    // the page (and DevTools) every time the snackbar appears.
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const isOnAuthPage =
        currentPath.startsWith('/login') ||
        currentPath.startsWith('/register') ||
        currentPath.startsWith('/forgot-password') ||
        currentPath.startsWith('/reset-password') ||
        currentPath.startsWith('/verify-email');
      if (!isOnAuthPage) {
        window.location.href = '/login';
      }
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? 'API error');
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Public API ────────────────────────────────────────────────────────────
// All methods accept an optional AbortSignal so callers (e.g. the room page
// useEffect) can cancel in-flight requests when the user navigates away.
// fetch handles the signal natively and rejects with a DOMException whose
// name is 'AbortError' — callers should filter that out of their .catch.

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => apiFetch<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), signal }),
  delete: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      signal,
    }),
};
