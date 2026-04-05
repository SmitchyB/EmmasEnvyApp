import { Image } from 'expo-image'; // Import the Image module from the expo-image library
import React, { useCallback, useEffect, useState } from 'react'; // Import the React, useCallback, useEffect, and useState modules from the react library
import {
  ActivityIndicator, // Import the ActivityIndicator module from the react-native library
  Modal, // Import the Modal module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  ScrollView, // Import the ScrollView module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from the react-native-safe-area-context library
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl function from the constants/config file
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import theme colors from the constants/theme file
import type { PortfolioPhoto } from '@/lib/portfolio-api'; // Import the PortfolioPhoto type from the portfolio-api file
import { getPrimaryPortfolio } from '@/lib/portfolio-api'; // Import the getPrimaryPortfolio function from the portfolio-api file

type Props = {
  visible: boolean; // Controls modal visibility
  onClose: () => void; // Dismiss without confirming
  /** Paths as returned by API (`photo.url`), appended to inspo_pics. */
  onConfirm: (relativePaths: string[]) => void; // Called with selected relative paths when user taps Add selected
  initialSelected?: string[]; // Paths that start pre-selected when opening
};

export function PortfolioPickerModal({ visible, onClose, onConfirm, initialSelected = [] }: Props) {
  const insets = useSafeAreaInsets(); // Safe area padding for sheet
  const [loading, setLoading] = useState(false); // True while fetching primary portfolio
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]); // Thumbnails from public primary portfolio
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected)); // Set of selected relative paths

  //load the primary portfolio
  const load = useCallback(async () => {
    setLoading(true); // Show spinner in sheet
    // Try to get the primary portfolio
    try {
      const res = await getPrimaryPortfolio(); // Unauthenticated primary portfolio for inspo picking
      setPhotos(res?.portfolio?.photos ?? []); // Empty if 404 or no photos
    } catch {
      setPhotos([]); // On error show empty grid
    } finally {
      setLoading(false); // Hide spinner
    }
  }, []); // Stable load function

  //useEffect to load the primary portfolio
  useEffect(() => {
    // If the visible state is true, reset the selection and load the primary portfolio
    if (visible) {
      setSelected(new Set(initialSelected ?? [])); // Reset selection when opening with new defaults
      load(); // Refresh photos each time sheet opens
    }
  }, [visible, load, initialSelected]); // Dependencies for the useEffect

  // Function to toggle the selection of a portfolio photo
  const toggle = (url: string | null) => {
    if (!url) return; // Skip null portfolio URLs
    // Set the selected state to the new set of selected portfolio photos
    setSelected((prev) => {
      const next = new Set(prev); // Clone set for immutability
      if (next.has(url)) next.delete(url); // Deselect if already on
      else next.add(url); // Add to selection
      return next; // Return the new set of selected portfolio photos
    });
  };
 
  // Function to handle the done button
  const handleDone = () => {
    onConfirm([...selected]); // Pass array of paths to parent
    onClose(); // Close sheet
  };

  // Return the portfolio picker modal
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose from portfolio</Text>
          {loading ? (
            <ActivityIndicator color={NavbarColors.text} style={{ marginVertical: 24 }} />
          ) : photos.length === 0 ? (
            <Text style={styles.muted}>No portfolio photos available.</Text>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
              {photos.map((p) => {
                const path = p.url;
                const uri = uploadsUrl(path);
                const on = path ? selected.has(path) : false;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggle(path)}
                    style={[styles.thumbWrap, on && styles.thumbOn]}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={styles.thumbPlaceholder} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.row}>
            <Pressable style={styles.secondary} onPress={onClose}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={handleDone}>
              <Text style={styles.primaryText}>Add selected</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(20,12,18,0.97)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 12,
  },
  muted: {
    color: NavbarColors.textMuted,
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 360,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
  },
  thumbWrap: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbOn: {
    borderColor: GradientColors.pink,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  secondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    alignItems: 'center',
  },
  secondaryText: {
    color: NavbarColors.text,
    fontWeight: '600',
  },
  primary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: GradientColors.pinkDark,
    alignItems: 'center',
  },
  primaryText: {
    color: NavbarColors.text,
    fontWeight: '700',
  },
});
