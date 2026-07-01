import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavbarColors } from '@/constants/theme';

const LOGO_HEIGHT = 60;
const LOGO_WIDTH = 180;

/** Logo-only header; main nav (Home, Portfolio, Sign In/Up) is in the bottom tab bar. */
export function Header() {
  const insets = useSafeAreaInsets(); // Get the insets of the safe area
  const [logoError, setLogoError] = useState(false); // Set the logo error to false
  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.logoRow}>
        <View style={styles.logoWrap}>
          {!logoError ? (
            <Image
              source={require('@/assets/images/emmasenvy.png')}
              style={styles.logo}
              contentFit="contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <Text style={styles.logoText} numberOfLines={1}>
              Emmas Envy
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: NavbarColors.border,
  },
  logoRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    height: LOGO_HEIGHT,
    width: LOGO_WIDTH,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: NavbarColors.text,
  },
});
