import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavbarColors } from '@/constants/theme';

/** Placeholder; not hooked up yet. */
export default function PortfoliosScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Portfolios</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: NavbarColors.textMuted,
  },
});
