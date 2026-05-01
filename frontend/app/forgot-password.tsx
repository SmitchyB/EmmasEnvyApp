import { useRouter } from 'expo-router'; // for navigation
import React, { useEffect, useState } from 'react'; // for state management
import {
  ActivityIndicator, // for loading indicator
  KeyboardAvoidingView, // for keyboard avoiding view
  Platform, // for platform
  Pressable, // for pressable
  ScrollView, // for scroll view
  StyleSheet, // for style sheet
  Text, // for text
  TextInput // for text input
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // for safe area insets
import { GradientColors, NavbarColors } from '@/constants/theme'; // for colors
import { completeForgotPassword, requestPasswordReset, verifyForgotCode } from '@/lib/auth-api'; // for authentication

const RESEND_COOLDOWN_SEC = 5 * 60; // 5 minute cooldown between sends for same email/phone

type Step = 'identifier' | 'code' | 'password' | 'done'; // for step-by-step forgot password

//Function to parse the identifier 
function parseIdentifier(raw: string): { email?: string; phone?: string } {
  const t = raw.trim(); // trim the raw string
  if (!t) return {}; // if the string is empty, return an empty object
  if (t.includes('@')) return { email: t }; // if the string contains an @, return an object with the email
  const digits = t.replace(/\D/g, ''); // replace all non-digits with an empty string
  if (digits.length >= 10) return { phone: digits }; // if the length of the digits is greater than or equal to 10, return an object with the phone
  return { phone: t }; // otherwise, return an object with the phone
}

//Function to format the countdown
function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60); // get the minutes
  const s = totalSec % 60; // get the seconds 
  return `${m}:${s.toString().padStart(2, '0')}`; // return the formatted countdown
}

//Function to render the forgot password screen
export default function ForgotPasswordScreen() {
  //All the states for the forgot password screen
  const insets = useSafeAreaInsets();
  const router = useRouter(); // for navigation
  const [step, setStep] = useState<Step>('identifier'); // for the current step
  const [identifierInput, setIdentifierInput] = useState(''); // for the identifier input
  const [accountParams, setAccountParams] = useState<{ email?: string; phone?: string }>({}); // for the account parameters
  const [code, setCode] = useState(''); // for the code input
  const [resetToken, setResetToken] = useState<string | null>(null); // for the reset token
  const [newPassword, setNewPassword] = useState(''); // for the new password input
  const [confirmPassword, setConfirmPassword] = useState(''); // for the confirm password input
  const [loading, setLoading] = useState(false); // for the loading state
  const [error, setError] = useState<string | null>(null); // for the error state
  const [doneMessage, setDoneMessage] = useState<string | null>(null); // for the done message
  const [resendSec, setResendSec] = useState(0); // for the resend seconds

  //useEffect to update the resend seconds
  useEffect(() => {
    if (resendSec <= 0) return; // if the resend seconds are less than or equal to 0, return
    const t = setInterval(() => setResendSec((s) => (s <= 1 ? 0 : s - 1)), 1000); // set the interval to 1 second
    return () => clearInterval(t); // clear the interval
  }, [resendSec]); // dependency array

  //Function to send the reset code
  const sendResetCode = async (isResend: boolean) => {
    setError(null); // set the error to null
    const parsed = parseIdentifier(identifierInput); // parse the identifier
    if (!parsed.email && !parsed.phone) { // if the email and phone are not found, set the error
      setError('Enter the email or phone number on your account'); // set the error
      return; // return
    }
    if (isResend && resendSec > 0) return; // if the resend seconds are greater than 0, return

    setLoading(true); // set the loading to true
    //try to send the reset code
    try {
      await requestPasswordReset(parsed); // send the reset code
      setAccountParams(parsed); // set the account parameters
      if (!isResend) setStep('code'); // if the resend is not true, set the step to code
      setResendSec(RESEND_COOLDOWN_SEC); // set the resend seconds to the cooldown` 
      setCode(''); // set the code to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong'); // set the error to the error message
    } finally {
      setLoading(false); // set the loading to false
    }
  };

  //Function to handle the continue identifier
  const handleContinueIdentifier = () => {
    sendResetCode(false); //set the resend to false
  };

  //Function to handle the continue code
  const handleContinueCode = async () => {
    setError(null); // set the error to null
    const digits = code.replace(/\D/g, ''); // replace all non-digits with an empty string
    //if the length of the digits is less than 6, set the error
    if (digits.length < 6) {
      setError('Enter the 6-digit code'); // set the error to 'Enter the 6-digit code'
      return; 
    }
    setLoading(true); // set the loading to true
    //try to verify the forgot code
    try {
      const { resetToken: token } = await verifyForgotCode({ ...accountParams, code: digits }); // verify the forgot code
      setResetToken(token); // set the reset token
      setNewPassword(''); // set the new password to empty
      setConfirmPassword(''); // set the confirm password to empty
      setStep('password'); // set the step to password
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code'); // set the error to the error message
    } finally {
      setLoading(false); // set the loading to false
    }
  };

  //Function to handle the continue password
  const handleContinuePassword = async () => {
    setError(null); // set the error to null
    //if the reset token is not found, set the error
    if (!resetToken) {
      setError('Session expired. Please start over.'); // set the error to 'Session expired. Please start over.'
      return;
    }
    //if the new password is not found or the length of the new password is less than 8, set the error
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters'); // set the error to 'Password must be at least 8 characters'
      return;
    }
    //try to complete the forgot password
    try {
      const out = await completeForgotPassword({
        resetToken, // reset token
        newPassword, // new password
        confirmPassword, // confirm password
      });
      setDoneMessage(out.message); // set the done message
      setStep('done'); // set the step to done
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update password'); // set the error to the error message
    } finally {
      setLoading(false); // set the loading to false
    }
  };

  //Return the forgot password jsx
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Forgot password</Text>

        {step === 'identifier' && (
          <>
            <Text style={styles.prompt}>Please enter the email or phone number associated with your account.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email or phone"
              placeholderTextColor={NavbarColors.textMuted}
              value={identifierInput}
              onChangeText={setIdentifierInput}
              autoCapitalize="none"
              keyboardType="default"
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleContinueIdentifier}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={styles.prompt}>
              Please enter the 6-digit code we sent, or the code from your authenticator app if you have two-factor
              authentication enabled.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor={NavbarColors.textMuted}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={8}
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleContinueCode}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, (loading || resendSec > 0) && styles.primaryButtonDisabled]}
              onPress={() => sendResetCode(true)}
              disabled={loading || resendSec > 0}>
              <Text style={styles.secondaryButtonText}>
                {resendSec > 0 ? `Resend code (${formatCountdown(resendSec)})` : 'Resend code'}
              </Text>
            </Pressable>
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={styles.prompt}>Choose a new password.</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={NavbarColors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={NavbarColors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleContinuePassword}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>
          </>
        )}

        {step === 'done' && (
          <>
            {doneMessage ? <Text style={styles.info}>{doneMessage}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={() => router.replace('/tabs/account')}>
              <Text style={styles.primaryButtonText}>Back to sign in</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.backLink} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backLinkText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    color: NavbarColors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  prompt: {
    color: NavbarColors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
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
  info: {
    color: NavbarColors.text,
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
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
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: NavbarColors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: GradientColors.pinkLight,
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backLinkText: {
    color: NavbarColors.textMuted,
    fontSize: 16,
  },
});
