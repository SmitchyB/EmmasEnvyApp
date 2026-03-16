import React, { useState } from 'react'; // Import the React and useState from react for the state
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'; // Import the ActivityIndicator, Pressable, StyleSheet, Text, TextInput, and View from react-native for the components
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors from @/constants/theme for the colors
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth from @/contexts/AuthContext for the authentication
import { update2FA, updateAccount } from '@/lib/auth-api'; // Import the update2FA and updateAccount from @/lib/auth-api for the update 2FA and update account

type TwoFactorType = 'email' | 'phone' | 'totp'; // Define the type for the two factor type

// Define the mask email function
function maskEmail(email: string): string {
  if (!email || email.length < 5) return email; // If the email is not valid, return the email
  const [local, domain] = email.split('@'); // Split the email into local and domain
  if (!domain) return email; // If the domain is not valid, return the email
  const show = local.length <= 2 ? local : local.slice(0, 2) + '***'; // If the local is less than 2, return the local, otherwise return the local with ***
  return `${show}@${domain}`; // Return the masked email
}

// Define the mask phone function
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone; // If the phone is not valid, return the phone
  const digits = phone.replace(/\D/g, ''); // Replace the non-digits with an empty string
  if (digits.length < 4) return phone; // If the digits are not valid, return the phone
  return '***' + digits.slice(-4); // Return the masked phone
}

// Define the two factor section props type
type TwoFactorSectionProps = {
  hideTitle?: boolean; // When true, do not render the section title (e.g. when parent already has "Two-factor authentication")
};

// Define the two factor section component
export function TwoFactorSection({ hideTitle }: TwoFactorSectionProps = {}) {
  // All the state variables
  const { user, token, setSession } = useAuth(); // Get the user, token, and setSession from the useAuth
  const [loading, setLoading] = useState(false); // Get the loading from the useState
  const [error, setError] = useState<string | null>(null); // Get the error from the useState
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr_url: string } | null>(null); // Get the totp setup from the useState
  const [addEmailMode, setAddEmailMode] = useState(false); // Get the add email mode from the useState
  const [addPhoneMode, setAddPhoneMode] = useState(false); // Get the add phone mode from the useState
  const [addEmail, setAddEmail] = useState(''); // Get the add email from the useState
  const [addPhone, setAddPhone] = useState(''); // Get the add phone from the useState
  const [currentPassword, setCurrentPassword] = useState(''); // Get the current password from the useState
  const [confirmAction, setConfirmAction] = useState<null | 'disable' | { changeTo: TwoFactorType }>(null); // Get the confirm action from the useState
  const [confirmPassword, setConfirmPassword] = useState(''); // Get the confirm password from the useState
  const enabled = user?.two_factor_enabled ?? false; // Get the enabled from the user
  const currentType = (user?.two_factor_type as TwoFactorType) || null; // Get the current type from the user
  const hasEmail = !!(user?.email && String(user.email).trim()); // Get the has email from the user
  const hasPhone = !!(user?.phone && String(user.phone).trim()); // Get the has phone from the user

  // Defines the handle enable function
  const handleEnable = async (type: TwoFactorType) => {
    // If the token is not valid, return
    if (!token) return;
    setError(null); // Set the error to null
    setTotpSetup(null); // Set the totp setup to null
    setLoading(true); // Set the loading to true
    try {
      const result = await update2FA({ token, two_factor_enabled: true, two_factor_type: type }); // Update the 2FA with the token, two factor enabled, and two factor type
      // If the result has a user, set the session with the user and token and persist the session
      if (result.user) {
        setSession(result.user, token, { persist: true }); // Set the session with the user and token and persist the session
      }
      // If the result has a totp setup, set the totp setup
      if (result.totp_setup) {
        setTotpSetup(result.totp_setup); // Set the totp setup from the result
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable 2FA'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Defines the handle add email and enable function
  const handleAddEmailAndEnable = async () => {
    // If the token is not valid, return
    if (!token) return;
    const emailTrimmed = addEmail.trim(); // Set the email trimmed from the add email
    // If the email trimmed is not valid, set the error to 'Enter an email address' and return
    if (!emailTrimmed) {
      setError('Enter an email address'); // Set the error to 'Enter an email address' and return
      return;
    }
    // If the current password is not valid, set the error to 'Enter your current password to add email' and return
    if (!currentPassword.trim()) {
      setError('Enter your current password to add email'); // Set the error to 'Enter your current password to add email' and return
      return;
    }
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    //Try to update the account and enable the 2FA
    try {
      const { user: u } = await updateAccount(token, { // Update the account with the token, current password, and email
        current_password: currentPassword, // Current password of the user
        email: emailTrimmed, // Email of the user
      });
      setSession(u, token, { persist: true }); // Set the session with the user and token and persist the session
      const updated = await update2FA({ token, two_factor_enabled: true, two_factor_type: 'email' }); // Update the 2FA with the token, two factor enabled, and two factor type
      // If the updated result has a user, set the session with the user and token and persist the session
      if (updated.user) {
        setSession(updated.user, token, { persist: true }); // Set the session with the user and token and persist the session
      }
      setAddEmailMode(false); // Set the add email mode to false
      setAddEmail(''); // Set the add email to empty
      setCurrentPassword(''); // Set the current password to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add email and enable 2FA'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Defines the handle add phone and enable function
  const handleAddPhoneAndEnable = async () => {
    // If the token is not valid, return
    if (!token) return;
    const phoneTrimmed = addPhone.trim().replace(/\D/g, ''); // Set the phone trimmed from the add phone and replaced with digits
    // If the phone trimmed is not valid, set the error to 'Enter a valid phone number (at least 10 digits)' and return
    if (phoneTrimmed.length < 10) {
      setError('Enter a valid phone number (at least 10 digits)'); // Set the error to 'Enter a valid phone number (at least 10 digits)' and return
      return;
    }
    // If the current password is not valid, set the error to 'Enter your current password to add phone number' and return
    if (!currentPassword.trim()) {
      setError('Enter your current password to add phone number'); // Set the error to 'Enter your current password to add phone number' and return
      return;
    }
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    //Try to update the account and enable the 2FA
    try {
      const { user: u } = await updateAccount(token, { // Update the account with the token, current password, and phone
        current_password: currentPassword, // Current password of the user
        phone: addPhone.trim(), // Phone of the user
      });
      setSession(u, token, { persist: true }); // Set the session with the user and token and persist the session
      const result = await update2FA({ token, two_factor_enabled: true, two_factor_type: 'phone' }); // Update the 2FA with the token, two factor enabled, and two factor type
      // If the result has a user, set the session with the user and token and persist the session
      if (result.user) {
        setSession(result.user, token, { persist: true }); // Set the session with the user and token and persist the session
      }
      setAddPhoneMode(false); // Set the add phone mode to false
      setAddPhone(''); // Set the add phone to empty
      setCurrentPassword(''); // Set the current password to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add phone and enable 2FA'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Defines the handle change type function
  const handleChangeType = async (newType: TwoFactorType, currentPasswordForConfirm?: string) => {
    // If the token is not valid, return
    if (!token) return;
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    //Try to update the 2FA and change the type
    try {
      const result = await update2FA({ // Update the 2FA with the token, two factor enabled, and two factor type
        token, // Token for the user
        two_factor_enabled: true, // Two factor enabled
        two_factor_type: newType, // Two factor type
        ...(currentPasswordForConfirm && currentPasswordForConfirm.trim().length > 0 ? { current_password: currentPasswordForConfirm.trim() } : {}), // Current password for the confirm
      });
      // If the result has a user, set the session with the user and token and persist the session
      if (result.user) {
        setSession(result.user, token, { persist: true }); // Set the session with the user and token and persist the session
      }
      // If the result has a totp setup, set the totp setup
      if (result.totp_setup) {
        setTotpSetup(result.totp_setup); // Set the totp setup from the result
      }
      // If the new type is not totp, set the totp setup to null
      if (newType !== 'totp') {
        setTotpSetup(null); // Set the totp setup to null
      }
      setConfirmAction(null); // Set the confirm action to null
      setConfirmPassword(''); // Set the confirm password to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change 2FA method'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Defines the handle disable function
  const handleDisable = async (currentPasswordForConfirm?: string) => {
    // If the token is not valid, return
    if (!token) return;
    setError(null); // Set the error to null
    setLoading(true); // Set the loading to true
    //Try to update the 2FA and disable the 2FA
    try {
      const result = await update2FA({ // Update the 2FA with the token, two factor enabled, and two factor type
        token, // Token for the user
        two_factor_enabled: false, // Two factor enabled
        ...(currentPasswordForConfirm && currentPasswordForConfirm.trim().length > 0 ? { current_password: currentPasswordForConfirm.trim() } : {}), // Current password for the confirm
      });
      // If the result has a user, set the session with the user and token and persist the session
      if (result.user) {
        setSession(result.user, token, { persist: true }); // Set the session with the user and token and persist the session
      }
      setConfirmAction(null); // Set the confirm action to null
      setConfirmPassword(''); // Set the confirm password to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable 2FA'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Defines the submit confirm password function
  const submitConfirmPassword = () => {
    // If the confirm password is not valid, set the error to 'Enter your current password to continue.' and return
    if (!confirmPassword.trim()) {
      setError('Enter your current password to continue.'); // Set the error to 'Enter your current password to continue.' and return
      return;
    }
    setError(null); // Set the error to null
    // If the confirm action is disable, handle the disable function
    if (confirmAction === 'disable') {
      handleDisable(confirmPassword); // Handle the disable function with the confirm password
    }
    //Else if the confirm action is change to, handle the change type function
    else if (confirmAction && 'changeTo' in confirmAction) {
      handleChangeType(confirmAction.changeTo, confirmPassword); // Handle the change type function with the confirm password
    }
  };

  if (!user) return null; // If the user is not valid, return null

  const currentTypeLabel = // Get the current type label from the current type
    currentType === 'totp' ? 'Authenticator app' : currentType === 'email' ? 'Email' : currentType === 'phone' ? 'Phone (SMS)' : ''; // If the current type is totp, return 'Authenticator app', if the current type is email, return 'Email', if the current type is phone, return 'Phone (SMS)'

  // Return the two factor settings component that allows the user to enable, disable, and change the two factor type.
  return (
    <View style={[styles.section, hideTitle && styles.sectionCompact]}>
      {!hideTitle && <Text style={styles.sectionTitle}>Two-factor authentication</Text>}
      <Text style={styles.subtitle}>
        {enabled
          ? `Enabled (${currentTypeLabel}). You can change how you receive codes below.`
          : 'Add an extra layer of security when signing in.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {enabled ? (
        <>
          <Text style={styles.sectionLabel}>Current method: {currentTypeLabel}</Text>

          <Text style={styles.sectionLabel}>Change to:</Text>
          {hasEmail && currentType !== 'email' && (
            <Pressable
              style={styles.optionButton}
              onPress={() => setConfirmAction({ changeTo: 'email' })}
              disabled={loading || confirmAction !== null}>
              <Text style={styles.optionButtonText}>Email code</Text>
              <Text style={styles.optionHint}>Send codes to {maskEmail(user.email ?? '')}</Text>
            </Pressable>
          )}
          {hasPhone && currentType !== 'phone' && (
            <Pressable
              style={styles.optionButton}
              onPress={() => setConfirmAction({ changeTo: 'phone' })}
              disabled={loading || confirmAction !== null}>
              <Text style={styles.optionButtonText}>Phone (SMS)</Text>
              <Text style={styles.optionHint}>Send codes to {maskPhone(user.phone ?? '')}</Text>
            </Pressable>
          )}
          {currentType !== 'totp' && (
            <Pressable
              style={styles.optionButton}
              onPress={() => setConfirmAction({ changeTo: 'totp' })}
              disabled={loading || confirmAction !== null}>
              <Text style={styles.optionButtonText}>Authenticator app (TOTP)</Text>
              <Text style={styles.optionHint}>Use an authenticator app (e.g. Authy)</Text>
            </Pressable>
          )}

          {confirmAction && (
            <View style={styles.confirmForm}>
              <Text style={styles.confirmFormTitle}>
                {confirmAction === 'disable'
                  ? 'Enter your password to disable 2FA'
                  : `Enter your password to switch to ${confirmAction.changeTo === 'totp' ? 'Authenticator app' : confirmAction.changeTo === 'email' ? 'Email code' : 'Phone (SMS)'}`}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={NavbarColors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
                autoCapitalize="none"
              />
              <View style={styles.addFormRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => { setConfirmAction(null); setConfirmPassword(''); setError(null); }}
                  disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={submitConfirmPassword}
                  disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Confirm</Text>}
                </Pressable>
              </View>
            </View>
          )}

          {totpSetup && (
            <View style={styles.totpSetup}>
              <Text style={styles.totpTitle}>Add to your authenticator app</Text>
              <Text style={styles.totpSecret} selectable>{totpSetup.secret}</Text>
              <Text style={styles.totpHint}>
                Enter this secret key in your authenticator app. You will be asked for a code when signing in.
              </Text>
              <Pressable style={styles.button} onPress={() => setTotpSetup(null)}>
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[styles.button, styles.dangerButton]}
            onPress={() => setConfirmAction('disable')}
            disabled={loading || confirmAction !== null}>
            <Text style={styles.buttonText}>{loading ? 'Disabling…' : 'Disable 2FA'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Enable with:</Text>

          {hasEmail ? (
            <Pressable style={styles.optionButton} onPress={() => handleEnable('email')} disabled={loading}>
              <Text style={styles.optionButtonText}>Email code</Text>
              <Text style={styles.optionHint}>Send codes to {maskEmail(user.email ?? '')}</Text>
            </Pressable>
          ) : addEmailMode ? (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>Add email to use for 2FA</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={NavbarColors.textMuted}
                value={addEmail}
                onChangeText={setAddEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Current password (required to add email)"
                placeholderTextColor={NavbarColors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                editable={!loading}
              />
              <View style={styles.addFormRow}>
                <Pressable style={styles.secondaryButton} onPress={() => { setAddEmailMode(false); setError(null); }}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleAddEmailAndEnable} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Add email & enable 2FA</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.optionButton} onPress={() => setAddEmailMode(true)} disabled={loading}>
              <Text style={styles.optionButtonText}>Email code</Text>
              <Text style={styles.optionHint}>Add an email address to receive 6-digit codes when signing in</Text>
            </Pressable>
          )}

          {hasPhone ? (
            <Pressable style={styles.optionButton} onPress={() => handleEnable('phone')} disabled={loading}>
              <Text style={styles.optionButtonText}>Phone (SMS)</Text>
              <Text style={styles.optionHint}>Send codes to {maskPhone(user.phone ?? '')}</Text>
            </Pressable>
          ) : addPhoneMode ? (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>Add phone number to use for 2FA</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor={NavbarColors.textMuted}
                value={addPhone}
                onChangeText={setAddPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Current password (required to add phone)"
                placeholderTextColor={NavbarColors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                editable={!loading}
              />
              <View style={styles.addFormRow}>
                <Pressable style={styles.secondaryButton} onPress={() => { setAddPhoneMode(false); setError(null); }}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleAddPhoneAndEnable} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Add phone & enable 2FA</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.optionButton} onPress={() => setAddPhoneMode(true)} disabled={loading}>
              <Text style={styles.optionButtonText}>Phone (SMS)</Text>
              <Text style={styles.optionHint}>Add a phone number to receive 6-digit codes when signing in</Text>
            </Pressable>
          )}

          <Pressable style={styles.optionButton} onPress={() => handleEnable('totp')} disabled={loading}>
            <Text style={styles.optionButtonText}>Authenticator app (TOTP)</Text>
            <Text style={styles.optionHint}>Use an authenticator app (e.g. Authy or similar)</Text>
          </Pressable>

          {loading && !addEmailMode && !addPhoneMode && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={NavbarColors.text} />
            </View>
          )}

          {totpSetup && (
            <View style={styles.totpSetup}>
              <Text style={styles.totpTitle}>Add to your authenticator app</Text>
              <Text style={styles.totpSecret} selectable>{totpSetup.secret}</Text>
              <Text style={styles.totpHint}>
                Enter this secret key in your authenticator app. You will be asked for a code when signing in.
              </Text>
              <Pressable style={styles.button} onPress={() => setTotpSetup(null)}>
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionCompact: { marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: NavbarColors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: NavbarColors.textMuted, marginBottom: 16 },
  sectionLabel: { fontSize: 14, color: NavbarColors.textMuted, marginBottom: 12, fontWeight: '600' },
  error: { color: '#ff6b6b', marginBottom: 12, fontSize: 14 },
  button: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.7 },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  secondaryButtonText: { color: NavbarColors.text, fontSize: 16 },
  dangerButton: { backgroundColor: 'rgba(200,80,80,0.9)', marginTop: 8 },
  buttonText: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  optionButtonText: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  optionHint: { color: NavbarColors.textMuted, fontSize: 13, marginTop: 4 },
  addForm: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 16, marginBottom: 12 },
  addFormTitle: { color: NavbarColors.text, fontWeight: '600', marginBottom: 12, fontSize: 15 },
  confirmForm: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 16, marginBottom: 12, marginTop: 4 },
  confirmFormTitle: { color: NavbarColors.text, fontWeight: '600', marginBottom: 12, fontSize: 15 },
  addFormRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: NavbarColors.text,
    marginBottom: 10,
  },
  loadingWrap: { marginVertical: 12, alignItems: 'center' },
  totpSetup: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: NavbarColors.border },
  totpTitle: { fontSize: 16, fontWeight: '600', color: NavbarColors.text, marginBottom: 8 },
  totpSecret: { fontFamily: 'monospace', fontSize: 14, color: NavbarColors.text, marginBottom: 12, letterSpacing: 2 },
  totpHint: { color: NavbarColors.textMuted, fontSize: 13, marginBottom: 16 },
});
