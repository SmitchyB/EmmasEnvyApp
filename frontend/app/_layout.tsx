import { LinearGradient } from 'expo-linear-gradient'; // Import the LinearGradient component from expo-linear-gradient for the gradient background
import { DarkTheme, ThemeProvider } from '@react-navigation/native'; // Import the DarkTheme and ThemeProvider from @react-navigation/native for the theme
import { Stack } from 'expo-router'; // Import the Stack from expo-router for the navigation
import { StatusBar } from 'expo-status-bar'; // Import the StatusBar from expo-status-bar for the status bar
import { StyleSheet, View } from 'react-native'; // Import the StyleSheet and View from react-native for the styling
import 'react-native-reanimated'; // Import the reanimated library for the animations
import { Header } from '@/components/header'; // Import the Navbar component from @/components/navbar
import { GradientColors } from '@/constants/theme'; // Import the GradientColors from @/constants/theme

// Define the unstable settings for the Expo Router. It uses this to determine navigation behavior/routes.
export const unstable_settings = {
  anchor: 'tabs',
};

/** Top-left dark pink to bottom-right light; everything on top must stay transparent. */
const gradientColors = [GradientColors.pinkDarkest, GradientColors.pinkDark, GradientColors.pink, GradientColors.pinkLight] as const;
/** Give pinkDarkest ~50% more presence by delaying the transition to pinkDark. */
const gradientLocations: readonly [number, number, number, number] = [0, 0.4, 0.6, 1];

/** Theme with transparent screen/card so the gradient shows through everywhere. */
const TransparentTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={TransparentTheme}>
      <View style={styles.root}>
        <LinearGradient
          colors={gradientColors}
          locations={gradientLocations}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Header />
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}>
            <Stack.Screen name="tabs" />
          </Stack>
        </View>
      </View>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
