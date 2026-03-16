import { useRouter } from 'expo-router'; // Import the useRouter from expo-router for the router
import React, { useState } from 'react'; // Import the React and useState from react for the state
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'; // Import the ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, and View from react-native for the components
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth from @/contexts/AuthContext for the authentication
import { register } from '@/lib/auth-api'; // Import the register from @/lib/auth-api for the registration
import { getSignupDraft, clearSignupDraft } from '@/lib/signup-draft'; // Import the getSignupDraft and clearSignupDraft from @/lib/signup-draft for the signup draft
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors from @/constants/theme for the colors

type Step = 'choice' | 'method' | 'totp-setup'; // Define the type for the step
type Method = 'email' | 'phone' | 'totp'; // Define the type for the method

// Define the Signup2FAChoiceScreen component
export default function Signup2FAChoiceScreen() {
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets
  const { setSession, getDeviceId } = useAuth(); // Get the setSession and getDeviceId from the useAuth
  const router = useRouter(); // Get the router from the useRouter
  const draft = getSignupDraft(); // Get the draft from the getSignupDraft
  const [step, setStep] = useState<Step>('choice'); // Get the step from the useState
  const [loading, setLoading] = useState(false); // Get the loading from the useState
  const [error, setError] = useState<string | null>(null); // Get the error from the useState
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr_url: string } | null>(null); // Get the totp setup from the useState
  // Get the pending verify params from the useState
  const [pendingVerifyParams, setPendingVerifyParams] = useState<{
    tempToken: string; // Temp token for the 2FA
    signedUpWith: string; // Signed up with for the 2FA
  } | null>(null);

  // Handle no 2FA function to handle the no 2FA
  const handleNo2FA = async () => {
    // If the draft is not found, set the error to 'Missing sign-up data. Please start over.' and return
    if (!draft) {
      setError('Missing sign-up data. Please start over.'); // Set the error to 'Missing sign-up data. Please start over.'
      return;
    }
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    // Try to register the user with the email, phone, password, device id, and two factor enabled false
    try {
      const deviceId = await getDeviceId(); // Get the device id from the getDeviceId
      // Register the user with the email, phone, password, device id, and two factor enabled false
      const result = await register({
        email: draft.identifierType === 'email' ? draft.email : undefined, // Email of the user
        phone: draft.identifierType === 'phone' && draft.phone ? draft.phone : undefined, // Phone of the user
        password: draft.password, // Password of the user
        deviceId, // Device id of the user
        two_factor_enabled: false, // Two factor enabled false
      });
      clearSignupDraft(); // Clear the signup draft
      const signedUpWith = draft.identifierType === 'email' ? 'email' : 'phone'; // Get the signed up with from the draft
      // If the result has a user and a token, set the session with the user and token and persist the session
      if ('token' in result && result.user && result.token) {
        await setSession(result.user, result.token, { persist: true }); // Set the session with the user and token and persist the session
        router.replace({ pathname: '/complete-profile', params: { signedUpWith } }); // Redirect to the complete profile screen
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Handle method choice function to handle the method choice
  const handleMethodChoice = async (method: Method) => {
    if (!draft) {
      setError('Missing sign-up data. Please start over.'); // Set the error to 'Missing sign-up data. Please start over.'
      return;
    }
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    // Try to register the user with the email, phone, password, device id, and two factor enabled true and the method
    try {
      const deviceId = await getDeviceId(); // Get the device id from the getDeviceId
      // Register the user with the email, phone, password, device id, and two factor enabled true and the method
      const result = await register({
        email: draft.identifierType === 'email' ? draft.email : undefined, // Email of the user
        phone: draft.identifierType === 'phone' && draft.phone ? draft.phone : undefined, // Phone of the user
        password: draft.password, // Password of the user
        deviceId, // Device id of the user
        two_factor_enabled: true, // Two factor enabled true
        two_factor_type: method, // Method of the user
      });
      clearSignupDraft(); // Clear the signup draft
      const signedUpWith = draft.identifierType === 'email' ? 'email' : 'phone'; // Get the signed up with from the draft
      // If the result requires 2FA, set the two factor type and the totp setup
      if ('requires2FA' in result && result.requires2FA && result.tempToken) {
        const twoFactorType = result.twoFactorType || (method === 'totp' ? 'totp' : signedUpWith); // Get the two factor type from the result
        // If the method is totp and the result has a totp setup, set the totp setup and the pending verify params and set the step to totp-setup
        if (method === 'totp' && 'totp_setup' in result && result.totp_setup) {
          setTotpSetup(result.totp_setup); // Set the totp setup from the result
          setPendingVerifyParams({ tempToken: result.tempToken, signedUpWith }); // Set the pending verify params from the result
          setStep('totp-setup'); // Set the step to totp-setup
        }
        //Else redirect to the verify-2fa screen with the temp token, two factor type, and stay signed in
        else {
          //Redirect to the verify-2fa screen with the temp token, two factor type, and stay signed in
          router.replace({
            pathname: '/verify-2fa', // Pathname to the verify-2fa screen
            params: {
              tempToken: result.tempToken, // Temp token for the 2FA
              twoFactorType, // Two factor type for the 2FA
              staySignedIn: '1', // Stay signed in true
              fromSignUp: '1', // From sign up true
              signedUpWith, // Signed up with for the 2FA
            },
          });
        }
        return;
      }
      // If the result has a user and a token, set the session with the user and token and persist the session
      if ('token' in result && result.user && result.token) {
        await setSession(result.user, result.token, { persist: true }); // Set the session with the user and token and persist the session
        router.replace({ pathname: '/complete-profile', params: { signedUpWith } }); // Redirect to the complete profile screen
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Handle continue to verify function to handle the continue to verify
  const handleContinueToVerify = () => {
    // If the pending verify params is not found, return
    if (!pendingVerifyParams) return;
    //Redirect to the verify-2fa screen with the temp token, two factor type, stay signed in, from sign up, and signed up with
    router.replace({
      pathname: '/verify-2fa', // Pathname to the verify-2fa screen
      params: {
        tempToken: pendingVerifyParams.tempToken, // Temp token for the 2FA
        twoFactorType: 'totp', // Two factor type for the 2FA
        staySignedIn: '1', // Stay signed in true
        fromSignUp: '1', // From sign up true
        signedUpWith: pendingVerifyParams.signedUpWith, // Signed up with for the 2FA
      },
    });
  };
  // If the draft is not found and the step is not totp-setup, return the error
  if (!draft && step !== 'totp-setup') {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.error}>Missing sign-up data. Please go back and sign up again.</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  // Get the signed up with from the draft or the pending verify params
  const signedUpWith = draft ? (draft.identifierType === 'email' ? 'email' : 'phone') : (pendingVerifyParams?.signedUpWith ?? 'email');

  // If the step is totp-setup, return the totp setup content with the title, subtitle, secret label, secret, totp hint, and primary button
  if (step === 'totp-setup') {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Add to your authenticator app</Text>
        <Text style={styles.subtitle}>
          Open Google Authenticator, Microsoft Authenticator, or another TOTP app. Add this account by entering the key below or scanning a QR code if your app supports it.
        </Text>
        {totpSetup && (
          <>
            <Text style={styles.secretLabel}>Setup key</Text>
            <Text style={styles.secret} selectable>{totpSetup.secret}</Text>
            <Text style={styles.totpHint}>
              After adding the account, you’ll enter the 6-digit code from the app on the next screen to finish sign-up.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleContinueToVerify}>
              <Text style={styles.primaryButtonText}>I’ve added it, continue</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    );
  }

  // If the step is choice, return the choice content with the title, subtitle, button row, and buttons
  // If the step is method, return the method content with the title, subtitle, option buttons, and loading wrap
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Enable two-factor authentication?</Text>
      <Text style={styles.subtitle}>
        {step === 'choice'
          ? 'You can receive codes by email, phone, or use an authenticator app. Choose your preferred method after tapping Yes.'
          : 'Choose how you’ll get your 6-digit code when you sign in.'}
      </Text>

      {step === 'choice' ? (
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.buttonYes, loading && styles.buttonDisabled]}
            onPress={() => { setError(null); setStep('method'); }}
            disabled={loading}>
            <Text style={styles.buttonText}>Yes</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonNo, loading && styles.buttonDisabled]}
            onPress={handleNo2FA}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={NavbarColors.text} size="small" />
            ) : (
              <Text style={styles.buttonText}>No</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable style={styles.backLink} onPress={() => setStep('choice')}>
            <Text style={styles.backLinkText}>Back</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>How do you want to receive your codes?</Text>
          {signedUpWith === 'email' && (
            <Pressable
              style={styles.optionButton}
              onPress={() => handleMethodChoice('email')}
              disabled={loading}>
              <Text style={styles.optionButtonText}>Email</Text>
              <Text style={styles.optionHint}>We’ll send a code to your email when you sign in</Text>
            </Pressable>
          )}
          {signedUpWith === 'phone' && (
            <Pressable
              style={styles.optionButton}
              onPress={() => handleMethodChoice('phone')}
              disabled={loading}>
              <Text style={styles.optionButtonText}>Phone (SMS)</Text>
              <Text style={styles.optionHint}>We’ll send a code to your phone when you sign in</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.optionButton}
            onPress={() => handleMethodChoice('totp')}
            disabled={loading}>
            <Text style={styles.optionButtonText}>Authenticator app</Text>
            <Text style={styles.optionHint}>Use Google Authenticator, Microsoft Authenticator, or similar</Text>
          </Pressable>
        </>
      )}

      {loading && step === 'method' && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={NavbarColors.text} size="small" />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}
// Define the styles for the signup 2fa choice screen
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backLink: { alignSelf: 'flex-start', marginBottom: 16 },
  backLinkText: { color: NavbarColors.textMuted, fontSize: 16 },
  sectionTitle: { color: NavbarColors.text, fontSize: 18, fontWeight: '600', marginBottom: 16 },
  title: {
    color: NavbarColors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: NavbarColors.textMuted,
    fontSize: 16,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonYes: {
    backgroundColor: GradientColors.pinkDark,
  },
  buttonNo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: NavbarColors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  optionButtonText: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  optionHint: { color: NavbarColors.textMuted, fontSize: 13, marginTop: 4 },
  loadingWrap: { marginVertical: 12, alignItems: 'center' },
  error: {
    color: '#ff6b6b',
    marginTop: 20,
    fontSize: 14,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: NavbarColors.textMuted,
    fontSize: 16,
  },
  secretLabel: { color: NavbarColors.textMuted, fontSize: 14, marginBottom: 8, fontWeight: '600' },
  secret: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: NavbarColors.text,
    letterSpacing: 2,
    marginBottom: 16,
  },
  totpHint: { color: NavbarColors.textMuted, fontSize: 14, marginBottom: 24 },
  primaryButton: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: NavbarColors.text, fontSize: 17, fontWeight: '600' },
});
