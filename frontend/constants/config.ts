/**
 * API and app config.
 * - On device (Expo Go on Android/iPad): set EXPO_PUBLIC_API_URL to your computer's LAN IP, e.g. http://192.168.1.5:3002
 * - Run: EXPO_PUBLIC_API_URL=http://YOUR_IP:3002 npx expo start
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const envUrl = typeof process !== 'undefined' && (process as unknown as { env?: Record<string, string> }).env?.EXPO_PUBLIC_API_URL;

export const API_BASE = envUrl ?? extra?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002';

export function uploadsUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  const base = API_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/uploads/${p}`;
}
