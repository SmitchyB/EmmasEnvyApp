import { apiUrl, fetchWithAuth } from '@/lib/api';
import type { ServiceType } from '@/lib/booking-types';

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export type DiscountTypeApi = 'percentage' | 'flat_amount';

export interface PromoCodeDto {
  id: number;
  code: string;
  discount_type: DiscountTypeApi;
  discount_value: number;
  min_purchase_amount: number;
  expiration_date: string | null;
  usage_limit: number | null;
  current_usage_count: number;
  is_active: boolean;
  created_at: string;
  service_type_id: number | null;
}

export interface NewsletterDto {
  id: number;
  subject: string;
  content: string;
  promo_code_id: number | null;
  promo_code?: string | null;
  sent_at: string | null;
  created_by: number | null;
  created_at: string;
}

export async function listPromoCodes(token: string): Promise<PromoCodeDto[]> {
  const res = await fetchWithAuth(apiUrl('/api/promo-codes'), { method: 'GET', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { promo_codes?: PromoCodeDto[] };
  return data.promo_codes ?? [];
}

export async function createPromoCodeApi(
  token: string,
  body: {
    code: string;
    discount_type: 'percent' | 'fixed' | DiscountTypeApi;
    discount_value: number;
    min_purchase_amount?: number;
    expiration_date?: string | null;
    usage_limit?: number | null;
    is_active?: boolean;
    service_type_id?: number | null;
  }
): Promise<PromoCodeDto> {
  const res = await fetchWithAuth(
    apiUrl('/api/promo-codes'),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { promo_code: PromoCodeDto };
  return data.promo_code;
}

export async function patchPromoCodeApi(
  token: string,
  id: number,
  patch: Partial<{
    discount_type: 'percent' | 'fixed' | DiscountTypeApi;
    discount_value: number;
    min_purchase_amount: number;
    expiration_date: string | null;
    usage_limit: number | null;
    is_active: boolean;
    service_type_id: number | null;
  }>
): Promise<PromoCodeDto> {
  const res = await fetchWithAuth(
    apiUrl(`/api/promo-codes/${id}`),
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { promo_code: PromoCodeDto };
  return data.promo_code;
}

export async function deletePromoCodeApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/promo-codes/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
}

export async function listNewslettersApi(token: string, status?: 'draft' | 'sent'): Promise<NewsletterDto[]> {
  const path = status ? `/api/newsletters?status=${encodeURIComponent(status)}` : '/api/newsletters';
  const res = await fetchWithAuth(apiUrl(path), { method: 'GET', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { newsletters?: NewsletterDto[] };
  return data.newsletters ?? [];
}

export async function createNewsletterApi(
  token: string,
  body: { subject: string; content?: string; promo_code_id?: number | null }
): Promise<NewsletterDto> {
  const res = await fetchWithAuth(
    apiUrl('/api/newsletters'),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { newsletter: NewsletterDto };
  return data.newsletter;
}

export async function patchNewsletterApi(
  token: string,
  id: number,
  patch: Partial<{ subject: string; content: string; promo_code_id: number | null }>
): Promise<NewsletterDto> {
  const res = await fetchWithAuth(
    apiUrl(`/api/newsletters/${id}`),
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { newsletter: NewsletterDto };
  return data.newsletter;
}

export async function deleteNewsletterApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/newsletters/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
}

export async function sendNewsletterApi(token: string, id: number): Promise<NewsletterDto> {
  const res = await fetchWithAuth(
    apiUrl(`/api/newsletters/${id}/send`),
    { method: 'POST', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { newsletter: NewsletterDto };
  return data.newsletter;
}

/** Service labels for promo picker (any public / staff list). */
export function serviceLabel(s: ServiceType): string {
  return s.title || `Service #${s.id}`;
}
