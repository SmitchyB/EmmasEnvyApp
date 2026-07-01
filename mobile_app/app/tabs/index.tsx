import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchPublicServiceTypes,
  getPrimaryPortfolio,
  getSiteSettings,
  listAvailableRewardOfferings,
  type Portfolio,
  type PortfolioPhoto,
  type RewardOfferingDto,
  type ServiceType,
  type SiteSettings,
} from '@emmasenvy/shared';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeNextAppointment } from '@/components/home/HomeNextAppointment';
import { HomePortfolioPreview } from '@/components/home/HomePortfolioPreview';
import { HomeQuickActions } from '@/components/home/HomeQuickActions';
import { HomeRewardsCard } from '@/components/home/HomeRewardsCard';
import { uploadsUrl as configUploadsUrl } from '@/constants/config';
import { GradientColors, NavbarColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useBookingData } from '@/contexts/BookingDataContext';

const BOOK_CTA_LABEL = 'Book an appointment';
const DEFAULT_TITLE = 'Emmas Envy';

type PortfolioWithPhotos = Portfolio & { photos: PortfolioPhoto[] };

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshAppointments } = useBookingData();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioWithPhotos | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [rewardOfferings, setRewardOfferings] = useState<RewardOfferingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [settingsData, portfolioResult, services, offerings] = await Promise.all([
        getSiteSettings(),
        getPrimaryPortfolio(),
        fetchPublicServiceTypes(),
        listAvailableRewardOfferings(),
      ]);
      setSettings(settingsData);
      setPortfolio(portfolioResult?.portfolio ?? null);
      setServiceTypes(services);
      setRewardOfferings(offerings);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (user) {
        void refreshAppointments();
      }
    }, [load, user, refreshAppointments])
  );

  if (loading && !settings) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.loadingTitle}>Emmas Envy</Text>
        <ActivityIndicator size="large" color={NavbarColors.text} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const heroUri = settings ? configUploadsUrl(settings.home_hero_image) : null;
  const title = settings?.hero_title?.trim() || DEFAULT_TITLE;
  const rewardsEnabled = settings?.rewards_enabled ?? false;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: 8, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <HomeHero heroUri={heroUri} title={title} />

      {error && !settings ? (
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
      ) : null}

      <HomeNextAppointment serviceTypes={serviceTypes} />

      <HomeQuickActions rewardsEnabled={rewardsEnabled} />

      {portfolio ? <HomePortfolioPreview portfolio={portfolio} /> : null}

      <HomeRewardsCard rewardsEnabled={rewardsEnabled} offerings={rewardOfferings} />

      <Pressable
        onPress={() => router.push('/book-appointment')}
        style={({ pressed }) => [styles.bookCta, pressed && styles.bookCtaPressed]}
        accessibilityRole="button"
        accessibilityLabel={BOOK_CTA_LABEL}
      >
        <Text style={styles.bookCtaText}>{BOOK_CTA_LABEL}</Text>
      </Pressable>
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
  section: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: NavbarColors.textMuted,
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
  bookCta: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: GradientColors.pinkDark,
    alignItems: 'center',
  },
  bookCtaPressed: {
    opacity: 0.88,
  },
  bookCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: NavbarColors.text,
  },
});
