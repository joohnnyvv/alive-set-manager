export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (window.location.protocol === 'file:' || !window.location.host || window.location.port === '5173') {
    return `http://localhost:8080${cleanPath}`;
  }
  return cleanPath;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  return fetch(url, options);
}
