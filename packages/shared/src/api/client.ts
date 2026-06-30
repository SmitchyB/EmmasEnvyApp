export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  token: string | null | undefined
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}
