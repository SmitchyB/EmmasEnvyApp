import { Image } from 'expo-image'; // Import the Image module from the expo-image library
import React, { useEffect, useState } from 'react'; // Import the React, useEffect, and useState modules from the react library
import {
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

// Function to resolve a stored path or URI to a loadable image URI
function displayUri(stored: string): string | null {
  const u = String(stored).trim(); // Normalize whitespace
  if (!u) return null; // Empty string means no image
  // If the URI is an absolute or local URI, return the URI
  if (/^https?:\/\//i.test(u) || u.startsWith('file:') || u.startsWith('content:')) {
    return u; // Already an absolute or local URI
  }
  return uploadsUrl(u); // Relative uploads path → full API URL
}
//Define the AppointmentPhotoGalleryModal component
type Props = {
  visible: boolean; // Whether the gallery sheet modal is shown
  onClose: () => void; // Called when user dismisses the sheet
  title: string; // Header text for the sheet
  paths: string[]; // Raw stored paths from appointment inspo or completed_photos
};

//Define the AppointmentPhotoGalleryModal component
export function AppointmentPhotoGalleryModal({ visible, onClose, title, paths }: Props) {
  const insets = useSafeAreaInsets(); // Safe area for bottom sheet padding
  const [lightboxUri, setLightboxUri] = useState<string | null>(null); // Full-screen preview URI or null
  //useEffect to hide the lightbox when the sheet closes
  useEffect(() => {
    if (!visible) setLightboxUri(null); // Hide lightbox when sheet closes
  }, [visible]); // Return the visible
  const entries = paths.map((p, i) => ({ key: `${p}-${i}`, stored: p, uri: displayUri(p) })).filter((e) => e.uri); // Thumbs with resolved URIs only
  //Return the AppointmentPhotoGalleryModal component
  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{title}</Text>
            {entries.length === 0 ? (
              <Text style={styles.muted}>No photos to show.</Text>
            ) : (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
                {entries.map((e) => (
                  <Pressable
                    key={e.key}
                    onPress={() => setLightboxUri(e.uri)}
                    style={styles.thumbWrap}>
                    <Image source={{ uri: e.uri! }} style={styles.thumb} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.closeRow} onPress={onClose}>
              <Text style={styles.closeRowText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={lightboxUri != null}
        animationType="fade"
        transparent
        onRequestClose={() => setLightboxUri(null)}>
        <View style={styles.lightboxBackdrop}>
          <View style={[styles.lightboxInner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
            <Pressable style={styles.lightboxCloseBtn} onPress={() => setLightboxUri(null)}>
              <Text style={styles.lightboxCloseText}>Close</Text>
            </Pressable>
            {lightboxUri ? (
              <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} contentFit="contain" />
            ) : null}
          </View>
        </View>
      </Modal>
    </>
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
    borderColor: NavbarColors.border,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  closeRow: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: GradientColors.pinkDark,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  closeRowText: {
    color: NavbarColors.text,
    fontWeight: '700',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  lightboxInner: {
    flex: 1,
  },
  lightboxCloseBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lightboxCloseText: {
    color: NavbarColors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  lightboxImage: {
    flex: 1,
    width: '100%',
  },
});
