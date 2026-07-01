import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { GradientColors, NavbarColors } from '@/constants/theme';

type Action = {
  label: string;
  route: Href;
  accessibilityLabel: string;
};

export function HomeQuickActions({ rewardsEnabled }: { rewardsEnabled: boolean }) {
  const router = useRouter();
  const { user } = useAuth();

  const actions: Action[] = [
    { label: 'Book', route: '/book-appointment', accessibilityLabel: 'Book an appointment' },
    { label: 'Portfolio', route: '/tabs/portfolios', accessibilityLabel: 'View portfolio' },
    { label: 'Appointments', route: '/tabs/appointments', accessibilityLabel: 'View appointments' },
    user && rewardsEnabled
      ? { label: 'Rewards', route: '/rewards', accessibilityLabel: 'View rewards' }
      : { label: user ? 'Account' : 'Sign In', route: '/tabs/account', accessibilityLabel: 'Account' },
  ];

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => router.push(action.route)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
        >
          <Text style={styles.tileText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
    backgroundColor: GradientColors.pinkDark,
  },
  tileText: {
    fontSize: 15,
    fontWeight: '700',
    color: NavbarColors.text,
  },
});
