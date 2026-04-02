/**
 * API client and types for backend. Site settings drive the home page.
 */
import { API_BASE } from '@/constants/config';

const API_LOG = '[API]';

/** Build full API URL for a path (e.g. /api/auth/me). */
export function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Fetch with optional auth. When token is provided, adds Authorization: Bearer <token>.
 * Use for authenticated endpoints. Get token from useAuth().token or pass when available.
 */
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

export interface SiteSettings {
  rewards_enabled: boolean;
  home_hero_image: string | null;
  hero_title: string | null;
  home_hero_material: string | null;
  policy_appointment_cancellation: string | null;
  policy_service_guarantee_fix: string | null;
  policy_shipping_fulfillment: string | null;
  policy_rewards_loyalty: string | null;
  policy_privacy: string | null;
}

function isSiteSettingsShape(data: unknown): data is SiteSettings {
  return data !== null && typeof data === 'object' && 'rewards_enabled' in data;
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const url = `${API_BASE}/api/site-settings`;
  console.log(API_LOG, 'OUT GET', url, '| API_BASE:', API_BASE);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    console.log(API_LOG, 'IN', res.status, url, res.statusText || '');
    if (!res.ok) {
      console.warn(API_LOG, 'non-OK response', res.status, url);
      return null;
    }
    const data: unknown = await res.json();
    if (!isSiteSettingsShape(data)) {
      console.warn(API_LOG, 'invalid response shape', url);
      return null;
    }
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(API_LOG, 'ERR', url, message);
    return null;
  }
}
