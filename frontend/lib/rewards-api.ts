import { apiUrl, fetchWithAuth } from '@/lib/api';

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export type RewardTypeApi = 'percent_off' | 'dollar_off' | 'free_service';

export interface RewardOfferingDto {
  id: number;
  title: string;
  reward_type: RewardTypeApi;
  point_cost: number;
  value: number | null;
  min_purchase_amount: number | null;
  is_active: boolean;
  service_type_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface MeRewardsResponse {
  points: number;
  reward_history: {
    invoice_id: string;
    created_at: string;
    points_used: number;
    reward_title: string;
  }[];
}

export async function listRewardOfferingsAdmin(token: string): Promise<RewardOfferingDto[]> {
  const res = await fetchWithAuth(
    apiUrl('/api/reward-offerings'),
    { method: 'GET', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { reward_offerings?: RewardOfferingDto[] };
  return data.reward_offerings ?? [];
}

export async function createRewardOfferingApi(
  token: string,
  body: {
    title: string;
    reward_type: RewardTypeApi;
    point_cost: number;
    value?: number | null;
    min_purchase_amount?: number | null;
    is_active?: boolean;
    service_type_id?: number | null;
  }
): Promise<RewardOfferingDto> {
  const res = await fetchWithAuth(
    apiUrl('/api/reward-offerings'),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { reward_offering: RewardOfferingDto };
  return data.reward_offering;
}

export async function patchRewardOfferingApi(
  token: string,
  id: number,
  body: Partial<{
    title: string;
    reward_type: RewardTypeApi;
    point_cost: number;
    value: number | null;
    min_purchase_amount: number | null;
    is_active: boolean;
    service_type_id: number | null;
  }>
): Promise<RewardOfferingDto> {
  const res = await fetchWithAuth(
    apiUrl(`/api/reward-offerings/${id}`),
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { reward_offering: RewardOfferingDto };
  return data.reward_offering;
}

export async function deleteRewardOfferingApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/reward-offerings/${id}`), { method: 'DELETE' }, token);
  if (!res.ok && res.status !== 204) throw new Error(await readError(res));
}

export async function listAvailableRewardOfferings(params?: {
  points?: number;
  subtotal?: number;
  service_type_id?: number;
}): Promise<RewardOfferingDto[]> {
  const q = new URLSearchParams();
  if (params?.points != null) q.set('points', String(params.points));
  if (params?.subtotal != null) q.set('subtotal', String(params.subtotal));
  if (params?.service_type_id != null) q.set('service_type_id', String(params.service_type_id));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const res = await fetch(apiUrl(`/api/reward-offerings/available${suffix}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { reward_offerings?: RewardOfferingDto[] };
  return data.reward_offerings ?? [];
}

export async function getMeRewards(token: string): Promise<MeRewardsResponse> {
  const res = await fetchWithAuth(
    apiUrl('/api/invoices/rewards'),
    { method: 'GET', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as MeRewardsResponse;
}
