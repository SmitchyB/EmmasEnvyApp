import { apiUrl } from '../config';
import type { SiteSettings } from '../types/site-settings';

const API_LOG = '[API]';

function isSiteSettingsShape(data: unknown): data is SiteSettings {
  return data !== null && typeof data === 'object' && 'rewards_enabled' in data;
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const url = apiUrl('/api/site-settings');
  console.log(API_LOG, 'OUT GET', url);
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
