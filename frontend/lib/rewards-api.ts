import { apiUrl, fetchWithAuth } from '@/lib/api'; // Import the apiUrl and fetchWithAuth functions from @/lib/api

/* This file is the API for the rewards. It is used to create, update, and delete rewards. */ 

async function readError(res: Response): Promise<string> {
  // Try to read the error
  try {
    // Try to parse the response as a string
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText || `HTTP ${res.status}`; // Return the error
  } catch {
    // Return the error
    return res.statusText || `HTTP ${res.status}`; // Return the error
  }
}

export type RewardTypeApi = 'percent_off' | 'dollar_off' | 'free_service'; // The reward type api

// The reward offering dto
export interface RewardOfferingDto {
  id: number; // The id of the reward offering
  title: string; // The title of the reward offering
  reward_type: RewardTypeApi; // The reward type of the reward offering
  point_cost: number; // The point cost of the reward offering
  value: number | null; // The value of the reward offering
  min_purchase_amount: number | null; // The minimum purchase amount of the reward offering
  is_active: boolean; // The active status of the reward offering
  service_type_id: number | null; // The service type id of the reward offering
  created_at: string; // The created at date of the reward offering
  updated_at: string; // The updated at date of the reward offering
}
// The me rewards response interface
export interface MeRewardsResponse {
  points: number; // The points of the user
  reward_history: { // The reward history of the user
    invoice_id: string; // The invoice id of the reward
    created_at: string; // The created at date of the reward
    points_used: number; // The points used of the reward
    reward_title: string; // The title of the reward
  }[]; // The reward history of the user
}

// List the reward offerings admin
export async function listRewardOfferingsAdmin(token: string): Promise<RewardOfferingDto[]> {
  // Try to list the reward offerings admin
  const res = await fetchWithAuth(
    apiUrl('/api/reward-offerings'), // The url of the reward offerings
    { method: 'GET', headers: { Accept: 'application/json' } }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { reward_offerings?: RewardOfferingDto[] }; // Try to parse the response as a RewardOfferingDto array
  return data.reward_offerings ?? []; // Return the reward offerings
}

// Create a new reward offering
export async function createRewardOfferingApi(
  token: string, // The token of the user
  body: {
    title: string; // The title of the reward offering
    reward_type: RewardTypeApi; // The reward type of the reward offering
    point_cost: number; // The point cost of the reward offering
    value?: number | null; // The value of the reward offering
    min_purchase_amount?: number | null; // The minimum purchase amount of the reward offering
    is_active?: boolean; // The active status of the reward offering
    service_type_id?: number | null; // The service type id of the reward offering
  }
): Promise<RewardOfferingDto> {
  // Try to create a new reward offering
  const res = await fetchWithAuth(
    apiUrl('/api/reward-offerings'), // The url of the reward offerings
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { reward_offering: RewardOfferingDto }; // Try to parse the response as a RewardOfferingDto
  return data.reward_offering; // Return the reward offering
}

// Patch a reward offering
export async function patchRewardOfferingApi(
  token: string, // The token of the user
  id: number, // The id of the reward offering
  body: Partial<{
    title: string; // The title of the reward offering
    reward_type: RewardTypeApi; // The reward type of the reward offering
    point_cost: number; // The point cost of the reward offering
    value: number | null; // The value of the reward offering
    min_purchase_amount: number | null; // The minimum purchase amount of the reward offering
    is_active: boolean; // The active status of the reward offering
    service_type_id: number | null; // The service type id of the reward offering
  }>
): Promise<RewardOfferingDto> {
  // Try to patch the reward offering
  const res = await fetchWithAuth(
    apiUrl(`/api/reward-offerings/${id}`), // The url of the reward offering
    { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { reward_offering: RewardOfferingDto }; // Try to parse the response as a RewardOfferingDto
  return data.reward_offering; // Return the reward offering
}
// Delete a reward offering
export async function deleteRewardOfferingApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/reward-offerings/${id}`), { method: 'DELETE' }, token); // Fetch the reward offering
  if (!res.ok && res.status !== 204) throw new Error(await readError(res)); // If the response is not ok, throw an error
}

// List the available reward offerings
export async function listAvailableRewardOfferings(params?: {
  points?: number; // The points of the user
  subtotal?: number; // The subtotal of the user
  service_type_id?: number; // The service type id of the user
}): Promise<RewardOfferingDto[]> {
  const q = new URLSearchParams(); // Create a new URLSearchParams object
  if (params?.points != null) q.set('points', String(params.points)); // Set the points to the URLSearchParams object
  if (params?.subtotal != null) q.set('subtotal', String(params.subtotal)); // Set the subtotal to the URLSearchParams object
  if (params?.service_type_id != null) q.set('service_type_id', String(params.service_type_id)); // Set the service type id to the URLSearchParams object
  const suffix = q.toString() ? `?${q.toString()}` : ''; // Get the suffix from the URLSearchParams object
  const res = await fetch(apiUrl(`/api/reward-offerings/available${suffix}`), { method: 'GET', headers: { Accept: 'application/json' } }); // Fetch the reward offerings
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { reward_offerings?: RewardOfferingDto[] }; // Try to parse the response as a RewardOfferingDto array
  return data.reward_offerings ?? []; // Return the reward offerings
}

// Get the me rewards
export async function getMeRewards(token: string): Promise<MeRewardsResponse> {
  // Try to get the me rewards 
  const res = await fetchWithAuth(
    apiUrl('/api/invoices/rewards'), // The url of the invoices
    { method: 'GET', headers: { Accept: 'application/json' } }, // The options for the fetch
    token // The token of the user
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as MeRewardsResponse; // Return the me rewards
}
