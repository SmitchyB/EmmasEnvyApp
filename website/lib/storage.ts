"use client";

import { AUTH_TOKEN_KEY, DEVICE_ID_KEY } from "@emmasenvy/shared";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getAuthToken(): string | null {
  return safeGet(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  safeSet(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  safeRemove(AUTH_TOKEN_KEY);
}

export function getDeviceId(): string {
  let id = safeGet(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    safeSet(DEVICE_ID_KEY, id);
  }
  return id;
}
