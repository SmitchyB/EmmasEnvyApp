import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter from expo-router for the router
import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker from expo-image-picker for the image picker
import React, { useState } from 'react'; // Import the React and useState from react for the state
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
} from 'react-native'; // Import the ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, and View from react-native for the components
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth from @/contexts/AuthContext for the authentication
import { completeProfile, uploadProfilePhoto } from '@/lib/auth-api'; // Import the completeProfile and uploadProfilePhoto from @/lib/auth-api for the complete profile and upload profile photo
import type { CompleteProfileResult } from '@/lib/auth-api'; // Import the CompleteProfileResult from @/lib/auth-api for the complete profile result
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors from @/constants/theme for the colors

type SignedUpWith = 'email' | 'phone'; // Define the type for the signed up with

// Define the CompleteProfileScreen component
export default function CompleteProfileScreen() {
  //All the state variables
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets
  const { user, token, setSession } = useAuth(); // Get the user, token, and setSession from the useAuth
  const router = useRouter(); // Get the router from the useRouter
  const params = useLocalSearchParams<{ signedUpWith?: string }>(); // Get the params from the useLocalSearchParams
  const signedUpWith: SignedUpWith = params.signedUpWith === 'phone' ? 'phone' : 'email'; // Get the signed up with from the params
  const [firstName, setFirstName] = useState(user?.first_name ?? ''); // Get the first name from the useState
  const [lastName, setLastName] = useState(user?.last_name ?? ''); // Get the last name from the useState
  const [dob, setDob] = useState(user?.dob ?? ''); // Get the date of birth from the useState
  const [otherIdentifier, setOtherIdentifier] = useState(''); // Get the other identifier from the useState
  const [photoUri, setPhotoUri] = useState<string | null>(null); // Get the photo uri from the useState
  const [loading, setLoading] = useState(false); // Get the loading from the useState
  const [error, setError] = useState<string | null>(null); // Get the error from the useState

  // Handle pick image function to handle the pick image
  const pickImage = async () => {
    // Request the media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // If the status is not granted, set the error to 'Photo library permission is required to add a profile picture.' and return
    if (status !== 'granted') {
      setError('Photo library permission is required to add a profile picture.'); // Set the error to 'Photo library permission is required to add a profile picture.'
      return;
    }
    // Launch the image library async
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Media types options for the image picker
      allowsEditing: true, // Allows editing for the image picker
      aspect: [1, 1], // Aspect for the image picker
      quality: 0.8, // Quality for the image picker
    });
    // If the result is not canceled and the assets are not empty, set the photo uri and clear the error
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri); // Set the photo uri from the result
      setError(null); // Set the error to null
    }
  };

  // Handle submit function to handle the submit
  const handleSubmit = async () => {
    // Set the error to null
    setError(null);
    const first = firstName.trim();
    // If the first name is not found, set the error to 'First name is required' and return
    if (!first) {
      setError('First name is required'); // Set the error to 'First name is required'
      return;
    }
    // If the date of birth is not found, set the error to 'Date of birth is required' and return
    if (!dob.trim()) {
      setError('Date of birth is required'); // Set the error to 'Date of birth is required'
      return;
    }
    // If the token is not found, set the error to 'Session expired. Please sign in again.' and return
    if (!token) {
      setError('Session expired. Please sign in again.'); // Set the error to 'Session expired. Please sign in again.'
      return;
    }
    setLoading(true); // Set the loading to true
    // Try to complete the profile
    try {
      let profilePicture: string | undefined; //let the profile picture be undefined
      // If the photo uri is found, upload the profile photo
      if (photoUri) {
        const { user: updatedUser } = await uploadProfilePhoto(token, photoUri); // Upload the profile photo
        if (updatedUser.profile_picture) profilePicture = updatedUser.profile_picture; // Set the profile picture from the updated user
      }
      // Set the payload for the complete profile
      const payload: Parameters<typeof completeProfile>[1] = {
        first_name: first, // First name of the user
        dob: dob.trim(), // Date of birth of the user
      };
      if (lastName.trim()) payload.last_name = lastName.trim(); // If the last name is found, set the last name from the last name
      if (profilePicture) payload.profile_picture = profilePicture; // If the profile picture is found, set the profile picture from the profile picture
      // If the signed up with is phone and the other identifier is found, set the email from the other identifier
      if (signedUpWith === 'phone' && otherIdentifier.trim()) {
        payload.email = otherIdentifier.trim(); // Set the email from the other identifier
      }
      // If the signed up with is email and the other identifier is found, set the phone from the other identifier
      if (signedUpWith === 'email' && otherIdentifier.trim()) {
        payload.phone = otherIdentifier.trim().replace(/\D/g, ''); // Set the phone from the other identifier
      }
      // Try to complete the profile
      const result: CompleteProfileResult = await completeProfile(token, payload);
      if (result.user) {
        await setSession(result.user, result.token ?? token, { persist: true }); // Set the session with the user and token and persist the session
        router.replace('/tabs'); // Redirect to the tabs screen
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong'); // Set the error to the error message
    } finally {
      setLoading(false);
    }
  };

  const otherLabel = signedUpWith === 'email' ? 'Phone (optional)' : 'Email (optional)'; // Get the other label from the signed up with
  const otherPlaceholder = signedUpWith === 'email' ? 'Phone number' : 'Email address'; // Get the other placeholder from the signed up with

  // Return the complete profile screen with the title, subtitle, photo touchable, avatar, avatar placeholder, avatar placeholder text, photo hint, input, optional label, optional input, error, primary button, and primary button text
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>First name and date of birth are required.</Text>

        <Pressable style={styles.photoTouchable} onPress={pickImage} disabled={loading}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>+</Text>
            </View>
          )}
          <Text style={styles.photoHint}>Profile picture (optional)</Text>
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="First name *"
          placeholderTextColor={NavbarColors.textMuted}
          value={firstName}
          onChangeText={setFirstName}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Last name (optional)"
          placeholderTextColor={NavbarColors.textMuted}
          value={lastName}
          onChangeText={setLastName}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Date of birth (YYYY-MM-DD) *"
          placeholderTextColor={NavbarColors.textMuted}
          value={dob}
          onChangeText={setDob}
          keyboardType="numbers-and-punctuation"
          editable={!loading}
        />
        <Text style={styles.optionalLabel}>{otherLabel}</Text>
        <TextInput
          style={styles.input}
          placeholder={otherPlaceholder}
          placeholderTextColor={NavbarColors.textMuted}
          value={otherIdentifier}
          onChangeText={setOtherIdentifier}
          keyboardType={signedUpWith === 'email' ? 'phone-pad' : 'email-address'}
          autoCapitalize={signedUpWith === 'email' ? 'none' : undefined}
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Define the styles for the complete profile screen
const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 48 },
  title: {
    color: NavbarColors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  photoTouchable: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarPlaceholderText: { color: NavbarColors.text, fontSize: 36 },
  photoHint: { color: NavbarColors.textMuted, fontSize: 13 },
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
  optionalLabel: {
    color: NavbarColors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  error: { color: '#ff6b6b', marginBottom: 12, fontSize: 14 },
  primaryButton: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: NavbarColors.text, fontSize: 17, fontWeight: '600' },
});
