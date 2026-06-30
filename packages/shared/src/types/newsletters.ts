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
