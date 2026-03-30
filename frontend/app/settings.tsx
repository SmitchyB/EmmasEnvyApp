import { useRouter } from 'expo-router'; // Import the useRouter from expo-router for the router
import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker from expo-image-picker for the image picker
import React, { useCallback, useEffect, useState } from 'react'; // Import the React, useCallback, useEffect, and useState from react for the state
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
import { Dropdown } from '@/components/Dropdown'; // Import the Dropdown from @/components/Dropdown for the dropdown
import {
  getCountryNames,
  getStatesForCountry,
  countryHasStates,
} from '@/lib/countries-states'; // Import the getCountryNames, getStatesForCountry, and countryHasStates from @/lib/countries-states for the countries and states
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl from @/constants/config for the uploads url
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors from @/constants/theme for the colors
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth from @/contexts/AuthContext for the authentication
import {
  getSessions,
  revokeSession,
  untrustSession,
  updateProfile,
  updateAccount,
  uploadProfilePhoto,
} from '@/lib/auth-api'; // Import the getSessions, revokeSession, untrustSession, updateProfile, updateAccount, and uploadProfilePhoto from @/lib/auth-api for the authentication
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  type UserAddress,
} from '@/lib/me-api'; // Import the getAddresses, createAddress, updateAddress, deleteAddress, and type UserAddress from @/lib/me-api for the user addresses
import { TwoFactorSection } from '@/components/TwoFactorSection'; // Import the TwoFactorSection from @/components/TwoFactorSection for the two factor section

// Define the SettingsScreen component
export default function SettingsScreen() {
  // All the state variables
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets
  const { user, token, setSession, logout } = useAuth(); // Get the user, token, setSession, and logout from the useAuth
  const router = useRouter(); // Get the router from the useRouter
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof getSessions>>['sessions']>([]); // Get the sessions from the useState
  const [addresses, setAddresses] = useState<UserAddress[]>([]); // Get the addresses from the useState
  const [loadingSessions, setLoadingSessions] = useState(false); // Get the loading sessions from the useState
  const [loadingAddresses, setLoadingAddresses] = useState(false); // Get the loading addresses from the useState
  const [profileSaving, setProfileSaving] = useState(false); // Get the profile saving from the useState
  const [accountSaving, setAccountSaving] = useState(false); // Get the account saving from the useState
  const [sessionActionId, setSessionActionId] = useState<number | null>(null); // Get the session action id from the useState
  const [error, setError] = useState<string | null>(null); // Get the error from the useState
  const [firstName, setFirstName] = useState(''); // Get the first name from the useState
  const [lastName, setLastName] = useState(''); // Get the last name from the useState
  const [dob, setDob] = useState(''); // Get the date of birth from the useState
  const [photoUri, setPhotoUri] = useState<string | null>(null); // Get the photo uri from the useState
  const [secureUnlocked, setSecureUnlocked] = useState(false); // Get the secure unlocked from the useState
  const [currentPassword, setCurrentPassword] = useState(''); // Get the current password from the useState
  const [newEmail, setNewEmail] = useState(''); // Get the new email from the useState
  const [newPhone, setNewPhone] = useState(''); // Get the new phone from the useState
  const [newPassword, setNewPassword] = useState(''); // Get the new password from the useState
  const [confirmPassword, setConfirmPassword] = useState(''); // Get the confirm password from the useState
  const [addressFormVisible, setAddressFormVisible] = useState(false); // Get the address form visible from the useState
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null); // Get the editing address id from the useState
  // Get the address form from the useState
  const [addressForm, setAddressForm] = useState({
    full_name: '', // Get the full name from the useState
    address_line_1: '', // Get the address line 1 from the useState
    address_line_2: '', // Get the address line 2 from the useState
    city: '', // Get the city from the useState
    state_province: '', // Get the state province from the useState
    zip_postal_code: '', // Get the zip postal code from the useState
    country: '', // Get the country from the useState
    phone: '', // Get the phone from the useState
  });
  // Define the load sessions function
  const loadSessions = useCallback(async () => {
    // If the token is not valid, return
    if (!token) return;
    setLoadingSessions(true); // Set the loading sessions to true
    //Try to get the sessions from the API
    try {
      const { sessions: list } = await getSessions(token); // Get the sessions from the API
      setSessions(list); // Set the sessions to the list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions'); // Set the error to the error message
    } finally {
      setLoadingSessions(false); // Set the loading sessions to false
    }
  }, [token]); // Dependencies for the load sessions function

  // Define the load addresses function
  const loadAddresses = useCallback(async () => {
    // If the token is not valid, return
    if (!token) return;
    setLoadingAddresses(true); // Set the loading addresses to true
    //Try to get the addresses from the API
    try {
      const list = await getAddresses(token); // Get the addresses from the API
      setAddresses(list); // Set the addresses to the list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load addresses'); // Set the error to the error message
    } finally {
      setLoadingAddresses(false); // Set the loading addresses to false
    }
  }, [token]); // Dependencies for the load addresses function

  // Define the use effect to set the first name, last name, dob, new email, and new phone when the user is set
  useEffect(() => {
    // If the user is not valid, return
    if (user) {
      setFirstName(user.first_name ?? ''); // Set the first name to the user's first name
      setLastName(user.last_name ?? ''); // Set the last name to the user's last name
      setDob(user.dob ?? ''); // Set the dob to the user's dob
      setNewEmail(user.email ?? ''); // Set the new email to the user's email
      setNewPhone(user.phone ?? ''); // Set the new phone to the user's phone
    }
  }, [user]); // Dependencies for the use effect

  // Define the use effect to load the sessions and addresses when the token is set
  useEffect(() => {
    // If the token is valid, load the sessions and addresses
    if (token) {
      loadSessions(); // Load the sessions
      loadAddresses(); // Load the addresses
    }
  }, [token, loadSessions, loadAddresses]); // Dependencies for the use effect

  // Define the pick image function
  const pickImage = async () => {
    // Try to request the media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // If the status is not granted, set the error to 'Photo library permission required' and return
    if (status !== 'granted') {
      setError('Photo library permission required'); // Set the error to 'Photo library permission required' and return
      return;
    }
    // Launch the image library async
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', // Media types options for the image picker
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

  // Define the handle save profile function
  const handleSaveProfile = async () => {
    // If the token is not valid or the user is not valid, return
    if (!token || !user) return;
    setError(null); // Set the error to null
    setProfileSaving(true); // Set the profile saving to true
    //Try to save the profile
    try {
      // If the photo uri is found, upload the profile photo
      if (photoUri) {
        const { user: u } = await uploadProfilePhoto(token, photoUri); // Upload the profile photo
        setSession(u, token, { persist: true }); // Set the session with the user and token and persist the session
      }
      // Update the profile with the token, first name, last name, and dob
      const { user: u } = await updateProfile(token, {
        first_name: firstName.trim() || undefined, // First name of the user
        last_name: lastName.trim() || undefined, // Last name of the user
        dob: dob.trim() || null, // Date of birth of the user
      });
      setSession(u, token, { persist: true }); // Set the session with the user and token and persist the session
      setPhotoUri(null); // Set the photo uri to null
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile'); // Set the error to the error message
    } finally {
      setProfileSaving(false); // Set the profile saving to false
    }
  };
 // Define the handle unlock secure function
  const handleUnlockSecure = () => {
    // If the current password is not valid, set the error to 'Enter your current password' and return
    if (!currentPassword.trim()) {
      setError('Enter your current password'); // Set the error to 'Enter your current password' and return
      return;
    }
    setSecureUnlocked(true); // Set the secure unlocked to true
    setError(null); // Set the error to null
  };
 // Define the handle save account function
  const handleSaveAccount = async () => {
    // If the token is not valid or the secure unlocked is not valid, return
    if (!token || !secureUnlocked) return;
    const hasNew = (newEmail.trim() !== (user?.email ?? '')) || (newPhone.trim() !== (user?.phone ?? '')) || newPassword.length > 0; // If the new email, new phone, or new password is found
    if (!hasNew) {
      setError('Change email, phone, or password to save'); // Set the error to 'Change email, phone, or password to save' and return
      return;
    }
    // If the new password is not valid, set the error to 'New password must be at least 8 characters' and return
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters'); // Set the error to 'New password must be at least 8 characters' and return
      return;
    }
    // If the new password and confirm password do not match, set the error to 'New password and confirmation do not match' and return
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match'); // Set the error to 'New password and confirmation do not match' and return
      return;
    }
    setError(null); // Set the error to null
    setAccountSaving(true); // Set the account saving to true
    //Try to save the account
    try {
      // Update the account with the token, current password, new email, new phone, new password, and confirm password
      const { user: u } = await updateAccount(token, {
        current_password: currentPassword, // Current password of the user
        email: newEmail.trim() || undefined, // New email of the user
        phone: newPhone.trim() || undefined, // New phone of the user
        new_password: newPassword || undefined, // New password of the user
        confirm_password: confirmPassword || undefined, // Confirm password of the user
      });
      setSession(u, token, { persist: true }); // Set the session with the user and token and persist the session
      setSecureUnlocked(false); // Set the secure unlocked to false
      setCurrentPassword(''); // Set the current password to empty
      setNewPassword(''); // Set the new password to empty
      setConfirmPassword(''); // Set the confirm password to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update account'); // Set the error to the error message
    } finally {
      setAccountSaving(false); // Set the account saving to false
    }
  };

  // Define the open new address function
  const openNewAddress = () => {
    // Set the editing address id to null
    setEditingAddressId(null);
    // Set the address form to the empty address form
    setAddressForm({
      full_name: '', // Full name of the user
      address_line_1: '', // Address line 1 of the user
      address_line_2: '', // Address line 2 of the user
      city: '', // City of the user
      state_province: '', // State/province of the user
      zip_postal_code: '', // Zip/postal code of the user
      country: '', // Country of the user
      phone: '', // Phone of the user
    });
    setAddressFormVisible(true); // Set the address form visible to true
  };

  // Define the open edit address function
  const openEditAddress = (a: UserAddress) => {
    setEditingAddressId(a.id); // Set the editing address id to the address id
    // Set the address form to the address form
    setAddressForm({
      full_name: a.full_name, // Full name of the user
      address_line_1: a.address_line_1, // Address line 1 of the user
      address_line_2: a.address_line_2 ?? '', // Address line 2 of the user
      city: a.city, // City of the user
      state_province: a.state_province, // State/province of the user
      zip_postal_code: a.zip_postal_code, // Zip/postal code of the user
      country: a.country ?? '', // Country of the user
      phone: a.phone ?? '', // Phone of the user
    });
    setAddressFormVisible(true); // Set the address form visible to true
  };

  // Define the save address function
  const saveAddress = async () => {
    // If the token is not valid, return
    if (!token) return;
    const { full_name, address_line_1, city, state_province, zip_postal_code, country } = addressForm; // Get the full name, address line 1, city, state province, zip postal code, and country from the address form
    const needState = countryHasStates(country); // If the country has states
    // If the full name, address line 1, city, zip postal code, or country is not valid, set the error to 'Full name, address line 1, city, zip, and country are required' and return
    if (!full_name.trim() || !address_line_1.trim() || !city.trim() || !zip_postal_code.trim() || !country.trim()) {
      setError('Full name, address line 1, city, zip, and country are required'); // Set the error to 'Full name, address line 1, city, zip, and country are required' and return
      return;
    }
    // If the country has states and the state province is not valid, set the error to 'Please select a state or province.' and return
    if (needState && !state_province.trim()) {
      setError('Please select a state or province.'); // Set the error to 'Please select a state or province.' and return
      return;
    }
    setError(null); // Set the error to null
    //Try to save the address
    try {
      // If the editing address id is found, update the address
      if (editingAddressId) {
        // Update the address with the token, editing address id, full name, address line 1, address line 2, city, state province, zip postal code, country, and phone
        const updated = await updateAddress(token, editingAddressId, {
          full_name: full_name.trim(), // Full name of the user
          address_line_1: address_line_1.trim(), // Address line 1 of the user
          address_line_2: addressForm.address_line_2.trim() || undefined, // Address line 2 of the user 
          city: city.trim(), // City of the user
          state_province: state_province.trim(), // State/province of the user
          zip_postal_code: zip_postal_code.trim(), // Zip postal code of the user
          country: country.trim(), // Country of the user
          phone: addressForm.phone.trim() || undefined, // Phone of the user
        });
        setAddresses((prev) => prev.map((a) => (a.id === editingAddressId ? updated : a))); // Set the addresses to the previous addresses with the updated address
      } 
      // Else if the editing address id is not found, create the address
      else {
        // Create the address with the token, full name, address line 1, address line 2, city, state province, zip postal code, country, and phone
        const created = await createAddress(token, {
          full_name: full_name.trim(), // Full name of the user
          address_line_1: address_line_1.trim(), // Address line 1 of the user
          address_line_2: addressForm.address_line_2.trim() || undefined, // Address line 2 of the user
          city: city.trim(), // City of the user
          state_province: state_province.trim(), // State/province of the user
          zip_postal_code: zip_postal_code.trim(), // Zip postal code of the user
          country: country.trim(), // Country of the user
          phone: addressForm.phone.trim() || undefined, // Phone of the user
        });
        setAddresses((prev) => [created, ...prev]); // Set the addresses to the previous addresses with the created address
      }
      setAddressFormVisible(false); // Set the address form visible to false
      setEditingAddressId(null); // Set the editing address id to null
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save address'); // Set the error to the error message
    }
  };

  // Define the remove address function
  const removeAddress = async (id: number) => {
    if (!token) return; // If the token is not valid, return
    setError(null); // Set the error to null
    //Try to remove the address
    try {
      await deleteAddress(token, id); // Delete the address with the token and id
      setAddresses((prev) => prev.filter((a) => a.id !== id)); // Set the addresses to the previous addresses with the removed address
      // If the editing address id is the same as the id, set the address form visible to false and set the editing address id to null
      if (editingAddressId === id) {
        setAddressFormVisible(false); // Set the address form visible to false
        setEditingAddressId(null); // Set the editing address id to null
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete address'); // Set the error to the error message
    }
  };

  // Define the handle revoke session function
  const handleRevokeSession = async (sessionId: number) => {
    // If the token is not valid, return
    if (!token) return;
    const isCurrent = sessions.some((s) => s.id === sessionId && s.current); // If the session id is the current session
    setSessionActionId(sessionId); // Set the session action id to the session id
    setError(null); // Set the error to null
    //Try to revoke the session
    try {
      await revokeSession(token, sessionId); // Revoke the session with the token and session id
      setSessions((prev) => prev.filter((s) => s.id !== sessionId)); // Set the sessions to the previous sessions with the revoked session
      // If the session id is the current session, logout the user
      if (isCurrent) {
        await logout(); // Logout the user
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke session'); // Set the error to the error message
    } finally {
      setSessionActionId(null); // Set the session action id to null
    }
  };

  // Define the handle untrust session function
  const handleUntrustSession = async (sessionId: number) => {
    // If the token is not valid, return
    if (!token) return;
    setSessionActionId(sessionId); // Set the session action id to the session id
    setError(null); // Set the error to null
    //Try to untrust the session
    try {
      await untrustSession(token, sessionId); // Untrust the session with the token and session id
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, is_trusted_device: false } : s))); // Set the sessions to the previous sessions with the untrusted session
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update session'); // Set the error to the error message
    } finally {
      setSessionActionId(null); // Set the session action id to null
    }
  };

  // If the user is not valid, return the sign in to access settings component
  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.subtitle}>Sign in to access settings</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const photoUrl = uploadsUrl(photoUri ? undefined : user.profile_picture); //Get the photo url from the photo uri or the user profile picture

  // Return the content of the settings screen that allows the user to change their profile, address book, secure account, and two factor authentication
  const content = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Profile */}
      <Text style={styles.sectionTitle}>Profile</Text>
      <Pressable onPress={pickImage} style={styles.avatarWrap}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.avatar} />
        ) : photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>{(user.first_name || user.email || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.avatarHint}>Tap to change photo</Text>
      </Pressable>
      <TextInput style={styles.input} placeholder="First name" placeholderTextColor={NavbarColors.textMuted} value={firstName} onChangeText={setFirstName} editable={!profileSaving} />
      <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={NavbarColors.textMuted} value={lastName} onChangeText={setLastName} editable={!profileSaving} />
      <TextInput style={styles.input} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor={NavbarColors.textMuted} value={dob} onChangeText={setDob} editable={!profileSaving} />
      <Pressable style={[styles.primaryButton, profileSaving && styles.buttonDisabled]} onPress={handleSaveProfile} disabled={profileSaving}>
        {profileSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save profile</Text>}
      </Pressable>

      {/* Address book */}
      <Text style={styles.sectionTitle}>Address book</Text>
      {loadingAddresses ? (
        <ActivityIndicator color={NavbarColors.text} style={styles.loader} />
      ) : (
        <>
          {addresses.map((a) => (
            <View key={a.id} style={styles.addressCard}>
              <Text style={styles.addressSummary}>
                {a.full_name}, {a.address_line_1}, {a.city}, {a.state_province} {a.zip_postal_code}
              </Text>
              <View style={styles.addressActions}>
                <Pressable style={styles.smallButton} onPress={() => openEditAddress(a)}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.smallButton, styles.dangerSmall]} onPress={() => removeAddress(a.id)}>
                  <Text style={styles.smallButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable style={styles.secondaryButton} onPress={openNewAddress}>
            <Text style={styles.secondaryButtonText}>Add address</Text>
          </Pressable>
          {addressFormVisible && (
            <View style={styles.formBlock}>
              <Text style={styles.formTitle}>{editingAddressId ? 'Edit address' : 'New address'}</Text>
              <Text style={styles.dropdownLabel}>Country</Text>
              <Dropdown
                options={
                  addressForm.country && !getCountryNames().includes(addressForm.country)
                    ? [addressForm.country, ...getCountryNames()]
                    : getCountryNames()
                }
                value={addressForm.country}
                onSelect={(t) => setAddressForm((f) => ({
                  ...f,
                  country: t,
                  state_province: countryHasStates(t) ? '' : f.state_province,
                }))}
                placeholder="Select country"
              />
              {countryHasStates(addressForm.country) ? (
                <>
                  <Text style={styles.dropdownLabel}>State / Province</Text>
                  <Dropdown
                    options={(() => {
                      const states = getStatesForCountry(addressForm.country);
                      const current = addressForm.state_province;
                      if (current && !states.includes(current)) return [current, ...states];
                      return states;
                    })()}
                    value={addressForm.state_province}
                    onSelect={(t) => setAddressForm((f) => ({ ...f, state_province: t }))}
                    placeholder="Select state or province"
                  />
                </>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="State / Province (optional)"
                  placeholderTextColor={NavbarColors.textMuted}
                  value={addressForm.state_province}
                  onChangeText={(t) => setAddressForm((f) => ({ ...f, state_province: t }))}
                />
              )}
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={NavbarColors.textMuted} value={addressForm.full_name} onChangeText={(t) => setAddressForm((f) => ({ ...f, full_name: t }))} />
              <TextInput style={styles.input} placeholder="Address line 1" placeholderTextColor={NavbarColors.textMuted} value={addressForm.address_line_1} onChangeText={(t) => setAddressForm((f) => ({ ...f, address_line_1: t }))} />
              <TextInput style={styles.input} placeholder="Address line 2 (optional)" placeholderTextColor={NavbarColors.textMuted} value={addressForm.address_line_2} onChangeText={(t) => setAddressForm((f) => ({ ...f, address_line_2: t }))} />
              <TextInput style={styles.input} placeholder="City" placeholderTextColor={NavbarColors.textMuted} value={addressForm.city} onChangeText={(t) => setAddressForm((f) => ({ ...f, city: t }))} />
              <TextInput style={styles.input} placeholder="ZIP / Postal code" placeholderTextColor={NavbarColors.textMuted} value={addressForm.zip_postal_code} onChangeText={(t) => setAddressForm((f) => ({ ...f, zip_postal_code: t }))} />
              <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor={NavbarColors.textMuted} value={addressForm.phone} onChangeText={(t) => setAddressForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" />
              <View style={styles.rowButtons}>
                <Pressable style={styles.secondaryButton} onPress={() => { setAddressFormVisible(false); setEditingAddressId(null); }}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={saveAddress}>
                  <Text style={styles.primaryButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}

      {/* Secure account */}
      <Text style={styles.sectionTitle}>Email, phone & password</Text>
      {!secureUnlocked ? (
        <>
          <Text style={styles.mutedText}>Enter your current password to change email, phone, or password.</Text>
          <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={NavbarColors.textMuted} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <Pressable style={styles.primaryButton} onPress={handleUnlockSecure}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={NavbarColors.textMuted} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Phone" placeholderTextColor={NavbarColors.textMuted} value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="New password (leave blank to keep)" placeholderTextColor={NavbarColors.textMuted} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={NavbarColors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <View style={styles.rowButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => { setSecureUnlocked(false); setCurrentPassword(''); }}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, accountSaving && styles.buttonDisabled]} onPress={handleSaveAccount} disabled={accountSaving}>
              {accountSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save</Text>}
            </Pressable>
          </View>
        </>
      )}

      {/* 2FA */}
      <Text style={styles.sectionTitle}>Two-factor authentication</Text>
      <TwoFactorSection hideTitle />

      {/* Sessions & trusted devices */}
      <Text style={styles.sectionTitle}>Sessions & trusted devices</Text>
      <Text style={styles.mutedText}>Devices that can skip 2FA are marked as trusted. You can require 2FA on next login or sign out a device.</Text>
      {loadingSessions ? (
        <ActivityIndicator color={NavbarColors.text} style={styles.loader} />
      ) : (
        sessions.map((s) => (
          <View key={s.id} style={styles.sessionCard}>
            <Text style={styles.sessionDevice}>{s.device_name}{s.current ? ' (this device)' : ''}</Text>
            {s.is_trusted_device && <Text style={styles.trustedBadge}>Trusted</Text>}
            <View style={styles.sessionActions}>
              {s.is_trusted_device && (
                <Pressable style={styles.smallButton} onPress={() => handleUntrustSession(s.id)} disabled={sessionActionId !== null}>
                  <Text style={styles.smallButtonText}>{sessionActionId === s.id ? '…' : 'Require 2FA on next login'}</Text>
                </Pressable>
              )}
              <Pressable style={[styles.smallButton, styles.dangerSmall]} onPress={() => handleRevokeSession(s.id)} disabled={sessionActionId !== null}>
                <Text style={styles.smallButtonText}>{sessionActionId === s.id ? '…' : 'Sign out this device'}</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {content}
    </KeyboardAvoidingView>
  );
}

// Define the styles for the settings screen
const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subtitle: { color: NavbarColors.textMuted, marginBottom: 16, fontSize: 15 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backButtonText: { color: NavbarColors.text, fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', color: NavbarColors.text, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: NavbarColors.text, marginTop: 24, marginBottom: 12 },
  error: { color: '#ff6b6b', marginBottom: 12, fontSize: 14 },
  mutedText: { color: NavbarColors.textMuted, fontSize: 14, marginBottom: 12 },
  avatarWrap: { alignItems: 'center', marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: GradientColors.pinkDark, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: NavbarColors.text, fontSize: 32, fontWeight: '700' },
  avatarHint: { color: NavbarColors.textMuted, fontSize: 12, marginTop: 4 },
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
  primaryButton: { backgroundColor: GradientColors.pinkDark, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: NavbarColors.border },
  secondaryButtonText: { color: NavbarColors.text, fontSize: 16 },
  buttonDisabled: { opacity: 0.7 },
  loader: { marginVertical: 12 },
  addressCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 10 },
  addressSummary: { color: NavbarColors.text, fontSize: 14, marginBottom: 8 },
  addressActions: { flexDirection: 'row', gap: 10 },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    flexShrink: 1,
  },
  smallButtonText: { color: NavbarColors.text, fontSize: 14 },
  dangerSmall: { backgroundColor: 'rgba(200,80,80,0.4)' },
  formBlock: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 16, marginBottom: 16 },
  formTitle: { color: NavbarColors.text, fontWeight: '600', marginBottom: 12 },
  dropdownLabel: { color: NavbarColors.textMuted, fontSize: 14, marginBottom: 4, fontWeight: '500' },
  rowButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  sessionCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 10 },
  sessionDevice: { color: NavbarColors.text, fontSize: 15, fontWeight: '500' },
  trustedBadge: { color: GradientColors.pinkLight, fontSize: 12, marginTop: 4 },
  sessionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
});
