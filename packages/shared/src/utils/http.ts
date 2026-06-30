export async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientHttpStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export function isLikelyTransientFetchError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('timeout') ||
    m.includes('econnreset') ||
    m.includes('socket')
  );
}

function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || res.statusText);
  }
}

export { parseJson };
