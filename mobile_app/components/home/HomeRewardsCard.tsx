import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  findNearestAffordableOffering,
  formatRewardOfferingValue,
  type RewardOfferingDto,
} from '@emmasenvy/shared';
import { useAuth } from '@/contexts/AuthContext';
import { NavbarColors } from '@/constants/theme';

type HomeRewardsCardProps = {
  rewardsEnabled: boolean;
  offerings: RewardOfferingDto[];
};

export function HomeRewardsCard({ rewardsEnabled, offerings }: HomeRewardsCardProps) {
  const router = useRouter();
  const { user } = useAuth();

  if (!rewardsEnabled) return null;

  if (!user) {
    return (
      <Pressable
        onPress={() => router.push('/tabs/account')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Sign in to earn reward points"
      >
        <Text style={styles.label}>Rewards</Text>
        <Text style={styles.title}>Sign in to earn points</Text>
        <Text style={styles.link}>Learn more</Text>
      </Pressable>
    );
  }

  const points = user.reward_points ?? 0;
  const nearest = findNearestAffordableOffering(offerings, points);
  const nextGoal = offerings
    .filter((o) => o.point_cost > points)
    .sort((a, b) => a.point_cost - b.point_cost)[0];

  return (
    <Pressable
      onPress={() => router.push('/rewards')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${points} reward points`}
    >
      <Text style={styles.label}>Your rewards</Text>
      <Text style={styles.title}>{points} points</Text>
      {nearest ? (
        <Text style={styles.detail}>
          Redeem: {nearest.title} ({formatRewardOfferingValue(nearest)})
        </Text>
      ) : nextGoal ? (
        <Text style={styles.detail}>
          {nextGoal.point_cost - points} pts until {nextGoal.title}
        </Text>
      ) : (
        <Text style={styles.detail}>Browse available rewards</Text>
      )}
      <Text style={styles.link}>View rewards</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: NavbarColors.textMuted,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: NavbarColors.text,
  },
  detail: {
    marginTop: 4,
    fontSize: 14,
    color: NavbarColors.textMuted,
  },
  link: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: NavbarColors.text,
  },
});
