import { useFocusEffect } from '@react-navigation/native'; // Import the useFocusEffect hook from @react-navigation/native
import { Image } from 'expo-image'; // Import the Image component from expo-image
import { useCallback, useState } from 'react'; // Import the useState hook from react
import {
  ActivityIndicator, 
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'; // Import the ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, and View components from react-native
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets hook from react-native-safe-area-context
import { getSiteSettings, type SiteSettings } from '@/lib/api'; // Import the getSiteSettings function and the SiteSettings type from @/lib/api
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl function from @/constants/config
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors constant from @/constants/theme

const HERO_HEIGHT = 220; // Define the height of the hero image
const DEFAULT_TITLE = 'Emmas Envy'; // Define the default title of the home screen

export default function HomeScreen() {
  const insets = useSafeAreaInsets(); // Get the insets of the safe area
  const [settings, setSettings] = useState<SiteSettings | null>(null); // Set the settings to null
  const [loading, setLoading] = useState(true); // Set the loading to true
  // Define the load function to get the site settings from the backend
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSiteSettings();
      setSettings(data);
    } finally {
      setLoading(false);
    }
  }, []);
  // Define the useFocusEffect hook to load the site settings when the screen is focused
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  // Define the loading state to show a loading indicator when the site settings are loading
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.loadingTitle}>Emmas Envy</Text>
        <ActivityIndicator size="large" color={NavbarColors.text} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }
  
  const heroUri = settings ? uploadsUrl(settings.home_hero_image) : null; // Define the hero URI
  const title = settings?.hero_title?.trim() || DEFAULT_TITLE; // Define the title
  
  // Return the home screen with the hero image, title, and material and a default message if the settings from the backend are not loaded
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: 8, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero image and title*/}
      <View style={styles.heroWrap}>
        {heroUri ? (
          <Image
            source={{ uri: heroUri }}
            style={styles.heroImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.heroPlaceholder} />
        )}
        <View style={styles.heroOverlay} />
        <Text style={styles.heroTitle}>{title}</Text>
      </View>
      {/* Hero material */}
      {settings?.home_hero_material?.trim() ? (
        <View style={styles.section}>
          <Text style={styles.bodyText}>{settings.home_hero_material}</Text>
        </View>
      ) : null}
      {/* Fallback when no settings */}
      {!settings && !loading && (
        <View style={styles.section}>
          <Text style={styles.errorTitle}>Could not load content</Text>
          <Text style={styles.bodyText}>
            Check your connection and ensure the server is running. Then try again.
          </Text>
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading content"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    color: NavbarColors.textMuted,
  },
  heroWrap: {
    height: HERO_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    justifyContent: 'flex-end',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: NavbarColors.text,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: NavbarColors.textMuted,
  },
});
