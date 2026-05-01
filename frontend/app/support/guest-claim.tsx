//Guest Claim Screen that allows the user to claim a ticket

import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter modules from expo-router
import React, { useState } from 'react'; // Import the React and useState modules from react
import {
  ActivityIndicator, // Import the ActivityIndicator module from react-native
  Pressable, // Import the Pressable module from react-native
  ScrollView, // Import the ScrollView module from react-native
  StyleSheet, // Import the StyleSheet module from react-native
  Text, // Import the Text module from react-native
  TextInput, // Import the TextInput module from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from react-native-safe-area-context
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors modules from @/constants/theme
import { setGuestTicketToken } from '@/lib/guest-ticket-storage'; // Import the setGuestTicketToken module from @/lib/guest-ticket-storage
import { guestClaimTicket } from '@/lib/tickets-api'; // Import the guestClaimTicket module from @/lib/tickets-api

//
//Define the GuestClaimScreen component
export default function GuestClaimScreen() {
  //All the state variables are defined here
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation
  const params = useLocalSearchParams<{ ref?: string }>(); // Get the local search params
  const [ref, setRef] = useState(typeof params.ref === 'string' ? params.ref : ''); // Initialize the ref state
  const [email, setEmail] = useState(''); // Initialize the email state
  const [phone, setPhone] = useState(''); // Initialize the phone state
  const [loading, setLoading] = useState(false); // Initialize the loading state
  const [error, setError] = useState<string | null>(null); // Initialize the error state

  //Define the submit function to submit the form
  const submit = async () => {
    setError(null); // Set the error state to null
    // If the ref is not found, set the error state to 'Enter your ticket number' and return
    if (!ref.trim()) {
      setError('Enter your ticket number'); // Set the error state to 'Enter your ticket number'
      return; // Return
    }
    if (!email.trim() && !phone.trim()) {
      setError('Enter the email or phone on the ticket'); // Set the error state to 'Enter the email or phone on the ticket'
      return; // Return
    }
    setLoading(true); // Set the loading state to true
    // Try to claim the ticket
    try {
      // Claim the ticket
      const { guest_ticket_token } = await guestClaimTicket({
        public_reference: ref.trim(), // Set the public reference
        email: email.trim() || undefined, // Set the email
        phone: phone.trim() || undefined, // Set the phone
      });
      await setGuestTicketToken(guest_ticket_token); // Set the guest ticket token
      router.replace('/support/guest-chat'); // Replace the current screen with the guest chat screen
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open ticket'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  };

  //Return a view with a title, a muted text, a text input for the ticket number, a text input for the email, a text input for the phone, an error text, a button to continue to chat, and a button to go back
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Open your ticket</Text>
      <Text style={styles.muted}>Enter the ticket number we sent (SMS or email) and the same email or phone you used.</Text>
      <TextInput
        style={styles.input}
        placeholder="Ticket number (e.g. EE-…)"
        placeholderTextColor={NavbarColors.textMuted}
        value={ref}
        onChangeText={setRef}
        autoCapitalize="characters"
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional if you used phone)"
        placeholderTextColor={NavbarColors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (optional if you used email)"
        placeholderTextColor={NavbarColors.textMuted}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={() => void submit()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue to chat</Text>}
      </Pressable>
      <Pressable style={styles.link} onPress={() => router.back()}>
        <Text style={styles.linkText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 24 },
  title: { color: NavbarColors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  muted: { color: NavbarColors.textMuted, fontSize: 15, marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: NavbarColors.text,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: NavbarColors.text, fontSize: 17, fontWeight: '600' },
  link: { marginTop: 20, alignSelf: 'center' },
  linkText: { color: GradientColors.pinkLight, fontSize: 15 },
  err: { color: '#ff6b6b', marginBottom: 8 },
});
