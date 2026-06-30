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
