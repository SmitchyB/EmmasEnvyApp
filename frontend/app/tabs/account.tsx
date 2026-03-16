import { useRouter } from 'expo-router'; // Import the useRouter hook from expo-router
import React, { useEffect, useState } from 'react'; // Import the React and useState hooks from react
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'; // Import the ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, and View components from react-native
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets hook from react-native-safe-area-context
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl function from @/constants/config
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors constants from @/constants/theme
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook from @/contexts/AuthContext
import { login } from '@/lib/auth-api'; // Import the login function from @/lib/auth-api
import { setSignupDraft } from '@/lib/signup-draft'; // Import the setSignupDraft function from @/lib/signup-draft

type AuthMode = 'signin' | 'signup'; // Define the AuthMode type as 'signin' or 'signup'
type IdentifierType = 'email' | 'phone'; // Define the IdentifierType type as 'email' or 'phone'

export default function AccountScreen() { // Define the AccountScreen component

  // All the state variables
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets hook
  const { user, setSession, logout, getDeviceId, isLoading: authLoading } = useAuth(); // Get the user, setSession, logout, getDeviceId, and authLoading from the useAuth hook
  const router = useRouter(); // Get the router from the useRouter hook
  const [mode, setMode] = useState<AuthMode>('signin'); // Get the mode from the useState hook
  const [identifierType, setIdentifierType] = useState<IdentifierType>('email'); // Get the identifier type from the useState hook
  const [email, setEmail] = useState(''); // Get the email from the useState hook
  const [phone, setPhone] = useState(''); // Get the phone from the useState hook
  const [password, setPassword] = useState(''); // Get the password from the useState hook
  const [confirmPassword, setConfirmPassword] = useState(''); // Get the confirm password from the useState hook
  const [staySignedIn, setStaySignedIn] = useState(true); // Get the stay signed in from the useState hook
  const [loading, setLoading] = useState(false); // Get the loading from the useState hook
  const [error, setError] = useState<string | null>(null); // Get the error from the useState hook

  // Redirect to complete-profile if logged in but profile incomplete using useEffect hook
  useEffect(() => {
    // If the user is not logged in or the user id is not found, return
    if (!user || !user.id) return;
    const needsProfile = !user.first_name || !user.dob; // Set the needs profile to true if the user first name or dob is not found
    //If the user needs to complete their profile, redirect to the complete-profile screen
    if (needsProfile) {
      const signedUpWith = user.email ? 'email' : 'phone'; // Set the signed up with to email if the user email is found, otherwise set it to phone
      router.replace({ pathname: '/complete-profile', params: { signedUpWith } }); // Redirect to the complete-profile screen with the signed up with
    }
  }, [user, router]); // Dependency array

  // Handle sign in function to sign in the user
  const handleSignIn = async () => {
    setError(null); // Set the error to null
    const useEmail = identifierType === 'email'; // Set the use email to true if the identifier type is email
    const emailVal = email.trim(); // Set the email value to the email trimmed
    const phoneVal = phone.trim().replace(/\D/g, ''); // Set the phone value to the phone trimmed and replaced with digits
    
    //If the user is using email and the email value is not found, set the error to 'Enter your email' and return
    if (useEmail && !emailVal) { 
      setError('Enter your email'); // Set the error to 'Enter your email'
      return;
    }
    //If the user is using phone and the phone value is less than 10 digits, set the error to 'Enter a valid phone number (at least 10 digits)' and return
    if (!useEmail && phoneVal.length < 10) {
      setError('Enter a valid phone number (at least 10 digits)'); // Set the error to 'Enter a valid phone number (at least 10 digits)'
      return;
    }
    //If the password is not found, set the error to 'Enter password' and return
    if (!password) {
      setError('Enter password'); // Set the error to 'Enter password'
      return;
    }
    setLoading(true); // Set the loading to true
    //Try to login the user
    try {
      const deviceId = await getDeviceId(); // Get the device id from the getDeviceId hook
      const result = await login({ // Login the user with the email, phone, password, stay signed in, and device id
        email: useEmail ? emailVal : undefined, // Email of the user
        phone: !useEmail && phoneVal.length >= 10 ? phoneVal : undefined, // Phone of the user
        password, // Password of the user
        staySignedIn, // Whether to stay signed in
        deviceId, // Device id of the user
      });
      //If the result requires 2FA, redirect to the verify-2fa screen
      if ('requires2FA' in result && result.requires2FA && result.tempToken) {
        //Redirect to the verify-2fa screen with the temp token, two factor type, and stay signed in
        router.push({
          pathname: '/verify-2fa', // Pathname to the verify-2fa screen
          params: { 
            tempToken: result.tempToken, // Temp token for the 2FA
            twoFactorType: result.twoFactorType || 'totp', // Two factor type for the 2FA
            staySignedIn: staySignedIn ? '1' : '0', // Whether to stay signed in
          },
        });
        return; // Return to stop the function
      }
      //If the result has a user and a token, set the session with the user and token and persist the session
      if ('user' in result && result.token) {
        await setSession(result.user, result.token, { persist: staySignedIn }); // Set the session with the user and token and persist the session
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed'); // Set the error to the error message
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // Handle sign up function to sign up the user
  const handleSignUp = () => {
    setError(null); // Set the error to null
    const useEmail = identifierType === 'email'; // Set the use email to true if the identifier type is email
    const emailVal = email.trim(); // Set the email value to the email trimmed
    const phoneVal = phone.trim().replace(/\D/g, ''); // Set the phone value to the phone trimmed and replaced with digits
    //If the user is using email and the email value is not found, set the error to 'Enter your email' and return
    if (useEmail && !emailVal) {
      setError('Enter your email');
      return;
    }
    //If the user is using phone and the phone value is less than 10 digits, set the error to 'Enter a valid phone number (at least 10 digits)' and return
    if (!useEmail && phoneVal.length < 10) {
      setError('Enter a valid phone number (at least 10 digits)');
      return;
    }
    //If the password is not found or the password is less than 8 characters, set the error to 'Password must be at least 8 characters' and return
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    //If the password and confirm password do not match, set the error to 'Passwords do not match' and return
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    //Set the signup draft with the email, phone, password, and identifier type
    setSignupDraft({
      email: useEmail ? emailVal : undefined, // Email of the user
      phone: !useEmail && phoneVal.length >= 10 ? phoneVal : undefined, // Phone of the user
      password, // Password of the user
      identifierType: identifierType, // Identifier type of the user
    }); 
    router.replace('/signup-2fa-choice'); // Redirect to the signup-2fa-choice screen
  };

  // Handle logout function to logout the user
  const handleLogout = async () => {
    setLoading(true); // Set the loading to true
    //Try to logout the user
    setLoading(true);
    try {
      await logout(); // Logout the user
      setEmail(''); // Set the email to empty
      setPhone(''); // Set the phone to empty
      setPassword(''); // Set the password to empty
      setConfirmPassword(''); // Set the confirm password to empty
      setError(null); // Set the error to null
    } finally {
      setLoading(false); // Set the loading to false
    }
  };

  // If the authentication is loading, return the activity indicator
  if (authLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator size="large" color={NavbarColors.text} />
      </View>
    );
  }

  // If the user is logged in, return the logged in content
  if (user) {
    const photoUrl = uploadsUrl(user.profile_picture); // Get the photo url from the uploadsUrl function
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Account'; // Get the display name from the user first name, last name, email, or 'Account'
    //Return the logged in content with the profile card, menu buttons, and sign out button
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.loggedInContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.profileCard}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{displayName}</Text>
          {user.email ? <Text style={styles.email}>{user.email}</Text> : null}
          {user.phone ? <Text style={styles.email}>{user.phone}</Text> : null}
        </View>
        <Pressable style={styles.menuButton} onPress={() => router.push('/settings')}>
          <Text style={styles.menuButtonText}>Settings</Text>
        </Pressable>
        <Pressable style={styles.menuButton} onPress={() => router.push('/purchases')}>
          <Text style={styles.menuButtonText}>Purchases</Text>
        </Pressable>
        <Pressable style={[styles.menuButton, styles.signOutButton]} onPress={handleLogout} disabled={loading}>
          <Text style={styles.signOutButtonText}>{loading ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // If the user is not logged in, return the guest content
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.guestContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, mode === 'signin' && styles.toggleActive]}
            onPress={() => { setMode('signin'); setError(null); }}>
            <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextActive]}>Sign In</Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, mode === 'signup' && styles.toggleActive]}
            onPress={() => { setMode('signup'); setError(null); }}>
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign Up</Text>
          </Pressable>
        </View>

        <View style={[styles.toggleRow, { marginBottom: 12 }]}>
          <Pressable
            style={[styles.toggle, identifierType === 'email' && styles.toggleActive]}
            onPress={() => { setIdentifierType('email'); setError(null); }}>
            <Text style={[styles.toggleText, identifierType === 'email' && styles.toggleTextActive]}>Email</Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, identifierType === 'phone' && styles.toggleActive]}
            onPress={() => { setIdentifierType('phone'); setError(null); }}>
            <Text style={[styles.toggleText, identifierType === 'phone' && styles.toggleTextActive]}>Phone</Text>
          </Pressable>
        </View>

        {identifierType === 'email' ? (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={NavbarColors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={NavbarColors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={NavbarColors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={NavbarColors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
          />
        )}
        {mode === 'signin' && (
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setStaySignedIn((v) => !v)}
            disabled={loading}>
            <View style={[styles.checkbox, staySignedIn && styles.checkboxChecked]} />
            <Text style={styles.checkboxLabel}>Stay signed in</Text>
          </Pressable>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={mode === 'signin' ? handleSignIn : handleSignUp}
          disabled={loading}>
          {loading && mode === 'signin' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Define the styles for the account screen
const styles = StyleSheet.create({
  // Define the centered style
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  guestContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  loggedInContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 4,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: GradientColors.pinkDark,
  },
  toggleText: {
    color: NavbarColors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: NavbarColors.text,
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
    marginBottom: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: NavbarColors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GradientColors.pinkDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholderText: {
    color: NavbarColors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  displayName: {
    color: NavbarColors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    color: NavbarColors.textMuted,
    fontSize: 15,
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  menuButtonText: {
    color: NavbarColors.text,
    fontSize: 16,
  },
  signOutButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  signOutButtonText: {
    color: NavbarColors.text,
    fontSize: 16,
  },
});
