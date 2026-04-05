import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from the expo-image-picker library
import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter modules from the expo-router library
import React, { useMemo, useState } from 'react'; // Import the React, useMemo, and useState modules from the react library
import {
  Alert, // Import the Alert module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from the react-native-safe-area-context library
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors module from the constants/theme file
import { appendInspoGuest } from '@/lib/booking-api'; // Import the appendInspoGuest module from the booking-api file

export default function GuestInspoUploadScreen() {
  const insets = useSafeAreaInsets(); // Get safe area insets for padding
  const router = useRouter(); // Router for navigation after upload or close
  const { inspoToken } = useLocalSearchParams<{ inspoToken?: string }>(); // JWT or token from deep link query
  const [busy, setBusy] = useState(false); // True while upload is in progress
  const token = typeof inspoToken === 'string' ? inspoToken.trim() : ''; // Normalized token string from params
  const valid = useMemo(() => token.length > 20, [token]); // Heuristic: guest tokens are long JWT-like strings
  const pick = async () => {
    if (!valid) return; // Do nothing if link is invalid
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); // Ask for photo library access
    // If the permission is not granted, show an alert
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload.'); // User declined permission
      return;
    }
    setBusy(true); // Show working state on the button
    // Try to append the inspiration photos
    try {
      // Launch the image library async
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Only still images
        allowsMultipleSelection: true, // Customer may attach several inspo photos
        quality: 0.85, // Balance size vs quality
      });
      if (res.canceled || !res.assets?.length) return; // User backed out or picked nothing
      const uris = res.assets.map((a) => a.uri).filter(Boolean); // Local file URIs to send
      await appendInspoGuest(token, uris); // PATCH appointment inspo_pics via guest endpoint
      Alert.alert('Thank you', 'Your inspiration photos were added.', [{ text: 'OK', onPress: () => router.back() }]); // Success and dismiss
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again or ask for a new link.'); // Network or API error
    } finally {
      setBusy(false); // Re-enable the button
    }
  };
  // Return the guest inspo upload screen
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Upload inspiration</Text>
      {!valid ? (
        <Text style={styles.muted}>Open this screen from the QR code or link your stylist shared.</Text>
      ) : (
        <>
          <Text style={styles.muted}>Choose photos from your library. They will be attached to your appointment.</Text>
          <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={pick} disabled={busy}>
            <Text style={styles.btnText}>{busy ? 'Working…' : 'Choose photos'}</Text>
          </Pressable>
        </>
      )}
      <Pressable style={styles.link} onPress={() => router.back()}>
        <Text style={styles.linkText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 12,
  },
  muted: {
    fontSize: 14,
    color: NavbarColors.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(194,24,91,0.9)',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: NavbarColors.text,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
