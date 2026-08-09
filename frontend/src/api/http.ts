export function getBackendPort(): number {
  if (typeof window !== 'undefined') {
    if ((window as any).__BACKEND_PORT__) {
      return Number((window as any).__BACKEND_PORT__);
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('backendPort') || params.get('port');
      if (p && !isNaN(Number(p))) {
        return Number(p);
      }
    } catch {}
    if (window.location.port && window.location.port !== '5173' && window.location.protocol !== 'file:') {
      return Number(window.location.port);
    }
  }
  return 8080;
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    if ((window as any).__AUTH_TOKEN__) {
      return String((window as any).__AUTH_TOKEN__);
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || params.get('authToken') || localStorage.getItem('asm_auth_token');
      return token;
    } catch {}
  }
  return null;
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (window.location.protocol === 'file:' || !window.location.host || window.location.port === '5173') {
    const port = getBackendPort();
    return `http://localhost:${port}${cleanPath}`;
  }
  return cleanPath;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  const token = getAuthToken();
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('x-auth-token')) {
    headers.set('x-auth-token', token);
  }
  return fetch(url, { ...options, headers });
}
