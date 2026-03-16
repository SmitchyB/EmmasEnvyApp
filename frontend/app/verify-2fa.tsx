import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter from expo-router for the router
import React, { useState } from 'react'; // Import the React and useState from react for the state
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'; // Import the ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, and View from react-native for the components
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth from @/contexts/AuthContext for the authentication
import { verify2FA } from '@/lib/auth-api'; // Import the verify2FA from @/lib/auth-api for the verification of the 2FA
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors from @/constants/theme for the colors

// Define the Verify2FAScreen component
export default function Verify2FAScreen() {
  //All the state variables
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets
  const { setSession, getDeviceId } = useAuth(); // Get the setSession and getDeviceId from the useAuth
  const router = useRouter(); // Get the router from the useRouter
  // Get the params from the useLocalSearchParams
  const params = useLocalSearchParams<{
    tempToken?: string; // Temp token for the 2FA
    twoFactorType?: string; // Two factor type for the 2FA
    staySignedIn?: string; // Stay signed in for the 2FA
    fromSignUp?: string; // From sign up for the 2FA
    signedUpWith?: string; // Signed up with for the 2FA
  }>();
  const tempToken = params.tempToken; // Get the temp token from the params
  const twoFactorType = params.twoFactorType || 'totp'; // Get the two factor type from the params
  const persist = params.staySignedIn !== '0'; // Get the persist from the params
  const fromSignUp = params.fromSignUp === '1'; // Get the from sign up from the params
  const signedUpWith = params.signedUpWith || 'email'; // Get the signed up with from the params
  const [code, setCode] = useState(''); // Get the code from the useState
  const [rememberDevice, setRememberDevice] = useState(true); // Get the remember device from the useState
  const [loading, setLoading] = useState(false); // Get the loading from the useState
  const [error, setError] = useState<string | null>(null); // Get the error from the useState

  // If the temp token is not found, return the error
  if (!tempToken) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.error}>Missing verification token. Please sign in again.</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Handle submit function to handle the submit
  const handleSubmit = async () => {
    // Set the digits from the code
    const digits = code.replace(/\D/g, '');
    // If the digits are less than 6, set the error to 'Enter at least 6 digits' and return
    if (digits.length < 6) {
      setError('Enter at least 6 digits'); // Set the error to 'Enter at least 6 digits'
      return;
    }
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    // Try to verify the 2FA
    try {
      // Get the device id from the getDeviceId
      const deviceId = await getDeviceId(); // Get the device id from the getDeviceId
      // Verify the 2FA with the temp token, code, remember device, and device id
      const result = await verify2FA({
        tempToken, // Temp token for the 2FA
        code: digits, // Code for the 2FA
        rememberDevice, // Remember device for the 2FA
        deviceId, // Device id for the 2FA
      });
      // If the result has a user and a token, set the session with the user and token and persist the session
      if (result.user && result.token) {
        await setSession(result.user, result.token, { persist }); // Set the session with the user and token and persist the session
        // If the from sign up is true, redirect to the complete profile screen with the signed up with
        if (fromSignUp) {
          router.replace({ pathname: '/complete-profile', params: { signedUpWith } }); // Redirect to the complete profile screen with the signed up with
        } else {
          router.replace('/tabs'); // Redirect to the tabs screen
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };
  // Get the hint from the two factor type
  const hint =
    twoFactorType === 'totp' // If the two factor type is totp, return the hint for the totp
      ? 'Enter the code from your authenticator app'
      : twoFactorType === 'email' // If the two factor type is email, return the hint for the email
        ? 'Enter the code we sent to your email'
        : 'Enter the code we sent to your phone'; // If the two factor type is phone, return the hint for the phone
  // Return the verify 2fa screen with the title, hint, input, checkbox row, checkbox, checkbox label, error, primary button, primary button text, back button, and back button text
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <Text style={styles.title}>Two-factor verification</Text>
      <Text style={styles.hint}>{hint}</Text>
      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor={NavbarColors.textMuted}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        editable={!loading}
        autoFocus
      />
      <Pressable
        style={styles.checkboxRow}
        onPress={() => setRememberDevice((v) => !v)}
        disabled={loading}>
        <View style={[styles.checkbox, rememberDevice && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>Remember this device</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify</Text>
        )}
      </Pressable>
      <Pressable style={styles.backButton} onPress={() => router.back()} disabled={loading}>
        <Text style={styles.backButtonText}>Cancel</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 15,
    color: NavbarColors.textMuted,
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    color: NavbarColors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: NavbarColors.border,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: GradientColors.pink,
    borderColor: GradientColors.pink,
  },
  checkboxLabel: {
    color: NavbarColors.text,
    fontSize: 15,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 12,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: NavbarColors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: NavbarColors.textMuted,
    fontSize: 16,
  },
});
