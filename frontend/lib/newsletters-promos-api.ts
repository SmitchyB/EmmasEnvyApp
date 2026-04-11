import { apiUrl, fetchWithAuth } from '@/lib/api'; // Import the apiUrl and fetchWithAuth functions from @/lib/api
import type { ServiceType } from '@/lib/booking-types'; // Import the ServiceType type from @/lib/booking-types

/* This file is the API for the newsletters and promos. It is used to create, update, and delete newsletters and promos. */ 

// Read the error 
async function readError(res: Response): Promise<string> {
  // Try to read the error
  try {
    const data = (await res.json()) as { error?: string }; // Try to read the error from the response
    return data.error || res.statusText || `HTTP ${res.status}`; // Return the error
  } catch {
    return res.statusText || `HTTP ${res.status}`; // Return the error
  }
}

export type DiscountTypeApi = 'percentage' | 'flat_amount'; // Export the DiscountTypeApi type

// Export the PromoCodeDto interface as a type
export interface PromoCodeDto {
  id: number; // The id of the promo code
  code: string; // The code of the promo code
  discount_type: DiscountTypeApi; // The discount type of the promo code
  discount_value: number; // The discount value of the promo code
  min_purchase_amount: number; // The minimum purchase amount of the promo code
  expiration_date: string | null; // The expiration date of the promo code
  usage_limit: number | null; // The usage limit of the promo code
  current_usage_count: number; // The current usage count of the promo code
  is_active: boolean; // The active status of the promo code
  created_at: string; // The created at date of the promo code
  service_type_id: number | null; // The service type id of the promo code
}

// Export the NewsletterDto interface as a type
export interface NewsletterDto {
  id: number; // The id of the newsletter
  subject: string; // The subject of the newsletter
  content: string; // The content of the newsletter
  promo_code_id: number | null; // The promo code id of the newsletter
  promo_code?: string | null; // The promo code of the newsletter
  sent_at: string | null; // The sent at date of the newsletter
  created_by: number | null; // The created by user id of the newsletter
  created_at: string; // The created at date of the newsletter
}

// List the promo codes
export async function listPromoCodes(token: string): Promise<PromoCodeDto[]> {
  const res = await fetchWithAuth(apiUrl('/api/promo-codes'), { method: 'GET', headers: { Accept: 'application/json' } }, token); // Fetch the promo codes
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { promo_codes?: PromoCodeDto[] }; // Try to parse the response as a PromoCodeDto array
  return data.promo_codes ?? []; // Return the promo codes
}

// Create a new promo code
export async function createPromoCodeApi(
  token: string, // The token of the user
  body: {
    code: string; // The code of the promo code
    discount_type: 'percent' | 'fixed' | DiscountTypeApi; // The discount type of the promo code
    discount_value: number; // The discount value of the promo code
    min_purchase_amount?: number; // The minimum purchase amount of the promo code
    expiration_date?: string | null; // The expiration date of the promo code
    usage_limit?: number | null; // The usage limit of the promo code
    is_active?: boolean; // The active status of the promo code 
    service_type_id?: number | null; // The service type id of the promo code
  }
): Promise<PromoCodeDto> {
  // Try to create a new promo code
  const res = await fetchWithAuth(
    apiUrl('/api/promo-codes'), // The url of the promo codes
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { promo_code: PromoCodeDto }; // Try to parse the response as a PromoCodeDto
  return data.promo_code; // Return the promo code
}

// Patch a promo code
export async function patchPromoCodeApi(
  token: string, // The token of the user
  id: number, // The id of the promo code
  patch: Partial<{
    discount_type: 'percent' | 'fixed' | DiscountTypeApi; // The discount type of the promo code
    discount_value: number; // The discount value of the promo code
    min_purchase_amount: number; // The minimum purchase amount of the promo code
    expiration_date: string | null; // The expiration date of the promo code
    usage_limit: number | null; // The usage limit of the promo code
    is_active: boolean; // The active status of the promo code
    service_type_id: number | null; // The service type id of the promo code
  }>
): Promise<PromoCodeDto> {
  // Try to patch the promo code
  const res = await fetchWithAuth(
    apiUrl(`/api/promo-codes/${id}`), // The url of the promo code
    { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { promo_code: PromoCodeDto }; // Try to parse the response as a PromoCodeDto
  return data.promo_code; // Return the promo code
}

// Delete a promo code
export async function deletePromoCodeApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/promo-codes/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token); // Fetch the promo code
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
}

// List the newsletters
export async function listNewslettersApi(token: string, status?: 'draft' | 'sent'): Promise<NewsletterDto[]> {
  const path = status ? `/api/newsletters?status=${encodeURIComponent(status)}` : '/api/newsletters'; // Get the path of the newsletters
  const res = await fetchWithAuth(apiUrl(path), { method: 'GET', headers: { Accept: 'application/json' } }, token); // Fetch the newsletters
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { newsletters?: NewsletterDto[] }; // Try to parse the response as a NewsletterDto array
  return data.newsletters ?? []; // Return the newsletters
}

// Create a new newsletter
export async function createNewsletterApi(
  token: string, // The token of the user
  body: { subject: string; content?: string; promo_code_id?: number | null } // The body of the newsletter
): Promise<NewsletterDto> {
  // Try to create a new newsletter
  const res = await fetchWithAuth(
    apiUrl('/api/newsletters'), // The url of the newsletters
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { newsletter: NewsletterDto }; // Try to parse the response as a NewsletterDto
  return data.newsletter; // Return the newsletter
}

// Patch a newsletter
export async function patchNewsletterApi(
  token: string, // The token of the user
  id: number, // The id of the newsletter
  patch: Partial<{ subject: string; content: string; promo_code_id: number | null }>
): Promise<NewsletterDto> {
  // Try to patch the newsletter
  const res = await fetchWithAuth(
    // The url of the newsletter
    apiUrl(`/api/newsletters/${id}`), // The url of the newsletter
    { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { newsletter: NewsletterDto }; // Try to parse the response as a NewsletterDto
  return data.newsletter; // Return the newsletter
}

// Delete a newsletter
export async function deleteNewsletterApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/newsletters/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token); // Fetch the newsletter
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
}
// Send a newsletter
export async function sendNewsletterApi(token: string, id: number): Promise<NewsletterDto> {
  // Try to send the newsletter
  const res = await fetchWithAuth(
    apiUrl(`/api/newsletters/${id}/send`), // The url of the newsletter
    { method: 'POST', headers: { Accept: 'application/json' } }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { newsletter: NewsletterDto }; // Try to parse the response as a NewsletterDto
  return data.newsletter; // Return the newsletter
}

// Return the service label for the promo picker
export function serviceLabel(s: ServiceType): string {
  return s.title || `Service #${s.id}`; // Return the service label
}
