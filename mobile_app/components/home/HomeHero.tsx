import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

type HomeHeroProps = {
  heroUri: string | null;
  title: string;
};

export function HomeHero({ heroUri, title }: HomeHeroProps) {
  return (
    <View style={styles.heroWrap}>
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={styles.heroImage} contentFit="cover" />
      ) : (
        <View style={styles.heroPlaceholder} />
      )}
      <View style={styles.heroOverlay} />
      <Text style={styles.heroTitle}>{title}</Text>
    </View>
  );
}

const HERO_HEIGHT = 220;

const styles = StyleSheet.create({
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
});
