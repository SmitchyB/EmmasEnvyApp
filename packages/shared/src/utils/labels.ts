import type { ServiceType } from '../types/booking';

export function serviceLabel(s: ServiceType): string {
  return s.title || `Service #${s.id}`;
}
