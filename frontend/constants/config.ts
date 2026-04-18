/**
 * API and app config.
 * - On device (Expo Go on Android/iPad): set EXPO_PUBLIC_API_URL to your computer's LAN IP, e.g. http://192.168.1.5:3002
 * - Run: EXPO_PUBLIC_API_URL=http://YOUR_IP:3002 npx expo start
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const procEnv = typeof process === 'undefined' ? undefined : (process as unknown as { env?: Record<string, string> }).env;

const envUrl = procEnv?.EXPO_PUBLIC_API_URL;

export const API_BASE = envUrl ?? extra?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002';

/** Square Web Payments (POS card modal). Must match the app/location in Square Dashboard. */
export const SQUARE_APPLICATION_ID =
  procEnv?.EXPO_PUBLIC_SQUARE_APPLICATION_ID ?? extra?.EXPO_PUBLIC_SQUARE_APPLICATION_ID ?? '';
export const SQUARE_LOCATION_ID = procEnv?.EXPO_PUBLIC_SQUARE_LOCATION_ID ?? extra?.EXPO_PUBLIC_SQUARE_LOCATION_ID ?? '';

export function uploadsUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  const base = API_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/uploads/${p}`;
}
