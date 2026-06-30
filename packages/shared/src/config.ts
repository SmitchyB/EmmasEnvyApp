export interface SharedConfig {
  apiBase: string;
}

let config: SharedConfig | null = null;

export function initSharedConfig(c: SharedConfig): void {
  config = c;
}

export function getConfig(): SharedConfig {
  if (!config) {
    throw new Error('Call initSharedConfig() before using @emmasenvy/shared');
  }
  return config;
}

/** Build full API URL for a path (e.g. /api/auth/me). */
export function apiUrl(path: string): string {
  const base = getConfig().apiBase.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function uploadsUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  const base = getConfig().apiBase.replace(/\/$/, '');
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/uploads/${p}`;
}
