import type { SiteSettings, RewardOfferingDto } from "@emmasenvy/shared";
import { formatRewardOfferingValue } from "@emmasenvy/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function HomeRewardsTeaser({
  settings,
  offerings,
}: {
  settings: SiteSettings;
  offerings: RewardOfferingDto[];
}) {
  if (!settings.rewards_enabled) return null;

  const programLine = settings.policy_rewards_loyalty?.trim();
  const topOfferings = offerings.slice(0, 2);
  if (!programLine && topOfferings.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-center text-2xl font-semibold text-white">Rewards</h2>
      <Card className="space-y-4 text-center">
        {programLine ? (
          <p className="text-sm leading-relaxed text-white/80">{truncate(programLine, 200)}</p>
        ) : null}
        {topOfferings.length > 0 ? (
          <ul className="space-y-2 text-sm text-white/75">
            {topOfferings.map((o) => (
              <li key={o.id}>
                <span className="font-medium text-white">{o.title}</span>
                {" — "}
                {formatRewardOfferingValue(o)} · {o.point_cost} pts
              </li>
            ))}
          </ul>
        ) : null}
        <Button href="/rewards" variant="secondary">
          View rewards
        </Button>
      </Card>
    </section>
  );
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}
