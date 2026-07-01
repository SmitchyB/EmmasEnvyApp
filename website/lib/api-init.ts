import { initSharedConfig } from "@emmasenvy/shared";

let initialized = false;

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

export function ensureSharedConfig(): void {
  if (initialized) return;
  initSharedConfig({ apiBase: getApiBase() });
  initialized = true;
}
