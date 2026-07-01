import type { RewardOfferingDto } from '../types/rewards';

export function formatRewardOfferingValue(o: RewardOfferingDto): string {
  if (o.reward_type === 'percent_off' && o.value != null) return `${o.value}% off`;
  if (o.reward_type === 'dollar_off' && o.value != null) return `$${o.value} off`;
  if (o.reward_type === 'free_service') return 'Free service';
  return '—';
}

/** Nearest affordable offering by point cost (at or below user's points). */
export function findNearestAffordableOffering(
  offerings: RewardOfferingDto[],
  points: number
): RewardOfferingDto | null {
  const affordable = offerings
    .filter((o) => o.point_cost <= points)
    .sort((a, b) => b.point_cost - a.point_cost);
  return affordable[0] ?? null;
}
