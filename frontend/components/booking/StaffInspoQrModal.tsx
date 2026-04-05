import * as Clipboard from 'expo-clipboard'; // Import the Clipboard module from the expo-clipboard library
import * as Linking from 'expo-linking'; // Import the Linking module from the expo-linking library
import React, { useEffect, useMemo, useState } from 'react'; // Import the React, useEffect, useMemo, and useState modules from the react library
import {
  Modal, // Import the Modal module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import QRCode from 'react-native-qrcode-svg'; // Import the QRCode component from the react-native-qrcode-svg library
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from the react-native-safe-area-context library
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import theme colors from the constants/theme file
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook from the AuthContext file
import { getAppointment, requestInspoUploadToken } from '@/lib/booking-api'; // Import booking API helpers from the booking-api file

type Props = {
  visible: boolean; // Whether the staff QR modal is shown
  appointmentId: number | null; // Appointment to bind guest uploads to
  initialInspoCount?: number; // Starting count for display until first poll
  onClose: () => void; // Dismiss modal
};
// Define the StaffInspoQrModal component
export function StaffInspoQrModal({ visible, appointmentId, initialInspoCount = 0, onClose }: Props) {
  const insets = useSafeAreaInsets(); // Top padding for modal backdrop
  const { token } = useAuth(); // Staff JWT for inspo token + polling
  const [jwt, setJwt] = useState<string | null>(null); // Short-lived guest upload JWT
  const [copied, setCopied] = useState(false); // Flash "Copied" on copy button
  const [remoteCount, setRemoteCount] = useState(initialInspoCount); // Live inspo_pics length from server

  //useEffect to reset the remote count when the modal is opened
  useEffect(() => {
    if (visible) setRemoteCount(initialInspoCount); // Reset count when opening with new appointment context
  }, [visible, initialInspoCount]); // Dependencies for the useEffect

  //useEffect to request the inspo upload token when the modal is opened
  useEffect(() => {
    // If the modal is not visible, the appointment id is not set, or the token is not set, return
    if (!visible || appointmentId == null || !token) {
      setJwt(null); // Clear token when modal hidden or missing deps
      return;
    }
    let cancelled = false; // Avoid setState after unmount
    //Async function to request the inspo upload token
    (async () => {
      // Try to request the inspo upload token
      try {
        const t = await requestInspoUploadToken(token, appointmentId); // POST staff-only endpoint for guest JWT
        if (!cancelled) setJwt(t); // Store for QR and deep link
      } catch {
        if (!cancelled) setJwt(null); // Failed to mint token
      }
    })();
    return () => {
      cancelled = true; // Invalidate in-flight request on close or deps change
    };
  }, [visible, appointmentId, token]);

  //useEffect to poll the appointment for the inspo count
  useEffect(() => {
    // If the modal is not visible, the appointment id is not set, or the token is not set, return
    if (!visible || appointmentId == null || !token) return; // No polling when modal closed
    // Set the interval to poll the appointment for the inspo count
    const iv = setInterval(() => {
      //Async function to poll the appointment for the inspo count
      (async () => {
        // Try to get the appointment for the inspo count
        try {
          const a = await getAppointment(token, appointmentId); // Refresh appointment for inspo count
          setRemoteCount(a.inspo_pics?.length ?? 0); // Update label for staff
        } catch {
          /* ignore */
        }
      })();
    }, 4000); // Poll every four seconds while open
    return () => clearInterval(iv); // Stop polling on unmount or deps change
  }, [visible, appointmentId, token]); // Dependencies for the useEffect

  //useMemo to create the URL for the guest inspo upload screen
  const href = useMemo(() => {
    if (!jwt) return ''; // No link until token ready
    // Create the URL for the guest inspo upload screen
    return Linking.createURL('/guest-inspo-upload', {
      queryParams: { inspoToken: jwt }, // Expo deep link into guest upload screen
    });
  }, [jwt]);

  // Function to copy the URL for the guest inspo upload screen
  const copy = async () => {
    if (!href) return; // Nothing to copy
    await Clipboard.setStringAsync(href); // Put URL on system clipboard
    setCopied(true); // Show feedback
    setTimeout(() => setCopied(false), 2000); // Reset label after two seconds
  };
  // Return the staff inspo qr modal
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.title}>Customer inspiration upload</Text>
          <Text style={styles.sub}>
            Ask the customer to scan the QR code or open the link on their phone. Photos attach to this appointment
            automatically.
          </Text>
          {href ? (
            <View style={styles.qrBox}>
              <QRCode value={href} size={200} backgroundColor="#fff" color="#000" />
            </View>
          ) : (
            <Text style={styles.muted}>Preparing link…</Text>
          )}
          <Text style={styles.link} numberOfLines={3}>
            {href || '—'}
          </Text>
          <Pressable style={styles.copyBtn} onPress={copy} disabled={!href}>
            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy link'}</Text>
          </Pressable>
          <Text style={styles.meta}>Inspiration photos on file: {remoteCount}</Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(22,14,20,0.98)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: NavbarColors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  qrBox: {
    alignSelf: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
  },
  muted: {
    color: NavbarColors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  link: {
    fontSize: 11,
    color: NavbarColors.textMuted,
    marginBottom: 8,
  },
  copyBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: GradientColors.pinkDark,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyText: {
    color: NavbarColors.text,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: NavbarColors.textMuted,
    marginBottom: 12,
  },
  closeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
  },
  closeText: {
    color: NavbarColors.text,
    fontWeight: '600',
  },
});
