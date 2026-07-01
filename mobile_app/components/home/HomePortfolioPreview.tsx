import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { uploadsUrl, type Portfolio, type PortfolioPhoto } from '@emmasenvy/shared';
import { NavbarColors } from '@/constants/theme';

type PortfolioWithPhotos = Portfolio & { photos: PortfolioPhoto[] };

const THUMB_SIZE = 100;
const PREVIEW_COUNT = 6;

export function HomePortfolioPreview({ portfolio }: { portfolio: PortfolioWithPhotos }) {
  const router = useRouter();
  const photos = [...(portfolio.photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, PREVIEW_COUNT);

  if (photos.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Recent work</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {photos.map((photo) => {
          const url = uploadsUrl(photo.url);
          if (!url) return null;
          return (
            <Pressable
              key={photo.id}
              onPress={() => router.push('/tabs/portfolios')}
              style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
              accessibilityRole="imagebutton"
              accessibilityLabel={photo.caption || 'Portfolio photo'}
            >
              <Image source={{ uri: url }} style={styles.thumbImage} contentFit="cover" />
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => router.push('/tabs/portfolios')}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="See all portfolio work"
        >
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 12,
  },
  scrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  seeAll: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: NavbarColors.text,
  },
  pressed: {
    opacity: 0.88,
  },
});
