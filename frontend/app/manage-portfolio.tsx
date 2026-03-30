import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from expo-image-picker
import { useRouter } from 'expo-router'; // Import the useRouter module from expo-router
import React, { useEffect, useMemo, useState } from 'react'; // Import the React, useEffect, useMemo, and useState modules from react
import {
  ActivityIndicator, // Import the ActivityIndicator module from react-native
  Image, // Import the Image module from react-native
  KeyboardAvoidingView, // Import the KeyboardAvoidingView module from react-native
  Modal, // Import the Modal module from react-native
  Platform, // Import the Platform module from react-native
  Pressable, // Import the Pressable module from react-native
  ScrollView, // Import the ScrollView module from react-native
  StyleSheet, // Import the StyleSheet module from react-native
  Switch, // Import the Switch module from react-native
  Text, // Import the Text module from react-native
  TextInput, // Import the TextInput module from react-native
  View, // Import the View module from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from react-native-safe-area-context
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl module from @/constants/config
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors modules from @/constants/theme
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from @/contexts/AuthContext
import type { User } from '@/lib/auth-types'; // Import the User type from @/lib/auth-types
import { apiUrl } from '@/lib/api'; // Import the apiUrl module from @/lib/api
import type { PortfolioPhoto } from '@/lib/portfolio-api'; // Import the PortfolioPhoto type from @/lib/portfolio-api
import {
  deletePortfolioPhoto,
  getMyPortfolio,
  saveMyPortfolio,
  updatePortfolioPhoto,
  uploadPortfolioPhoto,
} from '@/lib/portfolio-api';

// Define the ManagePortfolioScreen component
export default function ManagePortfolioScreen() {
  // All the state variables
  const insets = useSafeAreaInsets(); // Import the useSafeAreaInsets module from react-native-safe-area-context
  const router = useRouter(); // Import the useRouter module from expo-router
  const { user, token, setSession, fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true); // Import the useState module from react
  const [saving, setSaving] = useState(false); // Import the useState module from react
  const [error, setError] = useState<string | null>(null); // Import the useState module from react
  const [statusMessage, setStatusMessage] = useState<string | null>(null); // Import the useState module from react
  const [name, setName] = useState(''); // Import the useState module from react
  const [description, setDescription] = useState(''); // Import the useState module from react
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]); // Import the useState module from react
  const [visible, setVisible] = useState(false); // Import the useState module from react
  const [uploadingPhoto, setUploadingPhoto] = useState(false); // Import the useState module from react
  const [selectedPhoto, setSelectedPhoto] = useState<PortfolioPhoto | null>(null); // Import the useState module from react
  const [selectedPhotoCaption, setSelectedPhotoCaption] = useState(''); // Import the useState module from react
  const [updatingPhoto, setUpdatingPhoto] = useState(false); // Import the useState module from react
  const [deletingPhoto, setDeletingPhoto] = useState(false); // Import the useState module from react

  // Define the canManage function
  const canManage = useMemo(() => {
    // If the user is not logged in, return false
    if (!user) return false;
    return user.role === 'Admin' || user.role === 'IT'; // Return the user role is Admin or IT
  }, [user]);

  // Define the useEffect hook for loading the portfolio
  useEffect(() => {
    let cancelled = false; // Import the useState module from react
    // Define the load function
    async function load() {
      // If the token is not valid or the user cannot manage, set the loading state to false and return
      if (!token || !canManage) {
        setLoading(false); // Set the loading state to false
        return; // Return
      }
      setLoading(true); // Set the loading state to true
      setError(null); // Set the error state to null
      // Try to get the portfolio from the API
      try {
        const { portfolio } = await getMyPortfolio(token); // Get the portfolio from the API
        // If the portfolio is not found, create a new portfolio
        if (!portfolio) {
          // No portfolio yet – create an initial hidden portfolio entry so the user can start editing.
          const created = await saveMyPortfolio(token, {
            description: null,
            visible: false,
          });
          // If the portfolio is not cancelled, set the name, description, photos, and visible to the created portfolio
          if (!cancelled) {
            setName(created.portfolio.name ?? ''); // Set the name to the created portfolio name or empty string
            setDescription(created.portfolio.description ?? ''); // Set the description to the created portfolio description or empty string
            setPhotos(created.portfolio.photos ?? []); // Set the photos to the created portfolio photos or empty array
            setVisible(created.portfolio.visible ?? false); // Set the visible to the created portfolio visible or false
          }
          return; // Return
        }
        // If the portfolio is not cancelled, set the name, description, photos, and visible to the portfolio
        if (!cancelled) {
          setName(portfolio.name ?? ''); // Set the name to the portfolio name or empty string
          setDescription(portfolio.description ?? ''); // Set the description to the portfolio description or empty string
          setPhotos(portfolio.photos ?? []); // Set the photos to the portfolio photos or empty array
          setVisible(portfolio.visible ?? false); // Set the visible to the portfolio visible or false
        }
      }
      // If the portfolio is not found, create a new portfolio
      catch (e) {
        if (cancelled) return; // If the portfolio is cancelled, return
        const message = e instanceof Error ? e.message : String(e); // Set the message to the error message
        // If backend reports "not found" via error instead of 404 status, still create a hidden portfolio.
        if (token && canManage && /not found|404/i.test(message)) {
          // Try to create a new portfolio
          try {
            const created = await saveMyPortfolio(token, {
              description: null, // Set the description to null
              visible: false, // Set the visible to false
            });
            // If the portfolio is not cancelled, set the name, description, photos, and visible to the created portfolio
            if (!cancelled) {
              setName(created.portfolio.name ?? ''); // Set the name to the created portfolio name or empty string
              setDescription(created.portfolio.description ?? ''); // Set the description to the created portfolio description or empty string
              setPhotos(created.portfolio.photos ?? []); // Set the photos to the created portfolio photos or empty array
              setVisible(created.portfolio.visible ?? false); // Set the visible to the created portfolio visible or false
            }
          } 
          // If the portfolio is not cancelled, set the error to the create error message
          catch (createErr) {
            // If the portfolio is not cancelled, set the error to the create error message
            if (!cancelled) {
              // Set the error to the create error message
              setError(
                createErr instanceof Error // If the create error is an error, set the error to the create error message
                  ? createErr.message // If the create error is an error, set the error to the create error message
                  : 'Failed to create portfolio' // If the create error is not an error, set the error to 'Failed to create portfolio'
              );
            }
          }
        }
        // If the portfolio is not cancelled, set the error to the load error message
        else if (!cancelled) {
          setError(message || 'Failed to load portfolio'); // Set the error to the load error message
        }
      } 
      // If the portfolio is not cancelled, set the loading state to false
      finally {
        // If the portfolio is not cancelled, set the loading state to false
        if (!cancelled) {
          setLoading(false); // Set the loading state to false
        }
      }
    }
    load(); // Load the portfolio
    return () => {
      cancelled = true; // Set the cancelled flag to true
    };
  }, [token, canManage]); // Dependencies for the useEffect hook

  // Define the clearStatusSoon function
  const clearStatusSoon = () => {
    // If the status message is not null, set the status message to null after 2 seconds
    if (statusMessage) {
      // Set the status message to null after 2 seconds
      setTimeout(() => {
        setStatusMessage(null); // Set the status message to null
      }, 2000);
    }
  };

  // Define the handleSavePortfolio function
  const handleSavePortfolio = async () => {
    if (!token || !canManage) return; // If the token is not valid or the user cannot manage, return
    setError(null); // Set the error to null
    setStatusMessage(null); // Set the status message to null
    setSaving(true); // Set the saving state to true
    // Try to save the portfolio
    try {
      const { portfolio } = await saveMyPortfolio(token, {
        name: name.trim() || null,
        description: description.trim() || null,
        visible,
      });
      setName(portfolio.name ?? '');
      setPhotos(portfolio.photos ?? []);
      setVisible(portfolio.visible ?? true);
      const meRes = await fetchWithAuth(apiUrl('/api/auth/me'), {
        headers: { Accept: 'application/json' },
      });
      if (meRes.ok) {
        const data = (await meRes.json()) as { user?: User };
        if (data.user && token) {
          await setSession(data.user, token);
        }
      }
      setStatusMessage('Portfolio saved');
      clearStatusSoon();
    } 
    // If the portfolio is not saved, set the error to the save error message
    catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save portfolio'); // Set the error to the save error message
    } 
    // If the portfolio is not saved, set the saving state to false
    finally {
      setSaving(false); // Set the saving state to false
    }
  };
  // Define the handleAddPhoto function
  const handleAddPhoto = async () => {
    if (!token || !canManage) return; // If the token is not valid or the user cannot manage, return
    setError(null); // Set the error to null
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); // Request the media library permissions
    // If the status is not granted, set the error to 'Photo library permission required' and return
    if (status !== 'granted') {
      setError('Photo library permission required'); // Set the error to 'Photo library permission required' and return
      return;
    }
    // Launch the image library async
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', // Media types options for the image picker
      allowsEditing: true, // Allows editing for the image picker
      quality: 0.8, // Quality for the image picker
    });
    if (result.canceled || !result.assets[0]) return; // If the result is canceled or the assets are empty, return
    setUploadingPhoto(true); // Set the uploading photo state to true
    // Try to upload the photo
    try {
      const { photo } = await uploadPortfolioPhoto(token, result.assets[0].uri, 'portfolio-photo.jpg', 'image/jpeg'); // Upload the photo
      setPhotos((prev) => [photo, ...prev]); // Set the photos to the previous photos and the new photo
      setStatusMessage('Photo added'); // Set the status message to 'Photo added'
      clearStatusSoon(); // Clear the status soon
    } 
    // If the photo is not uploaded, set the error to the upload error message
    catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload photo'); // Set the error to the upload error message
    } 
    // If the photo is not uploaded, set the uploading photo state to false
    finally {
      setUploadingPhoto(false); // Set the uploading photo state to false
    }
  };

  // Define the openPhotoEditor function
  const openPhotoEditor = (photo: PortfolioPhoto) => {
    setSelectedPhoto(photo); // Set the selected photo to the photo
    setSelectedPhotoCaption(photo.caption ?? ''); // Set the selected photo caption to the photo caption or empty string
  };

  // Define the handleUpdatePhoto function
  const handleUpdatePhoto = async () => {
    if (!token || !canManage || !selectedPhoto) return; // If the token is not valid or the user cannot manage or the selected photo is not found, return
    setUpdatingPhoto(true); // Set the updating photo state to true
    setError(null); // Set the error to null
    // Try to update the photo
    try {
      // set the photo to the updated photo
      const { photo } = await updatePortfolioPhoto(token, selectedPhoto.id, {
        caption: selectedPhotoCaption.trim() || null, // Set the caption to the selected photo caption trimmed or null
      });
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? photo : p))); // Set the photos to the previous photos and the updated photo
      setStatusMessage('Caption saved'); // Set the status message to 'Caption saved'
      clearStatusSoon(); // Clear the status soon
      setSelectedPhoto(null); // Set the selected photo to null
    } 
    // If the photo is not updated, set the error to the update error message
    catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update caption'); // Set the error to the update error message
    } 
    // If the photo is not updated, set the updating photo state to false
    finally {
      setUpdatingPhoto(false); // Set the updating photo state to false
    }
  };

  // Define the handleDeletePhoto function
  const handleDeletePhoto = async () => {
    if (!token || !canManage || !selectedPhoto) return; // If the token is not valid or the user cannot manage or the selected photo is not found, return
    setDeletingPhoto(true); // Set the deleting photo state to true
    setError(null); // Set the error to null
    // Try to delete the photo
    try {
      await deletePortfolioPhoto(token, selectedPhoto.id); // Delete the photo
      setPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id)); // Set the photos to the previous photos and the filtered photo
      setSelectedPhoto(null); // Set the selected photo to null
      setStatusMessage('Photo deleted'); // Set the status message to 'Photo deleted'
      clearStatusSoon(); // Clear the status soon
    } 
    // If the photo is not deleted, set the error to the delete error message
    catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete photo'); // Set the error to the delete error message
    } 
    // If the photo is not deleted, set the deleting photo state to false
    finally {
      setDeletingPhoto(false); // Set the deleting photo state to false
    }
  };
  // If the user is not logged in or the user cannot manage, return the not authorized to manage a portfolio text
  if (!user || !canManage) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.subtitle}>Not authorized to manage a portfolio.</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }
  // If the loading state is true, return the loading indicator
  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}>
        <ActivityIndicator size="large" color={NavbarColors.text} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Manage portfolio</Text>
        <Text style={styles.subtitle}>
          Edit display name, bio, visibility, and gallery photos.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {statusMessage ? (
          <Text style={styles.status}>{statusMessage}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Bio</Text>
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={NavbarColors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Bio / description"
          placeholderTextColor={NavbarColors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleTitle}>Visible on Portfolios tab</Text>
            <Text style={styles.toggleSubtitle}>
              {visible ? 'On' : 'Off'} (customers will only see visible portfolios)
            </Text>
          </View>
          <Switch
            value={visible}
            onValueChange={setVisible}
            trackColor={{
              false: 'rgba(255,255,255,0.15)',
              true: GradientColors.pinkLight,
            }}
            thumbColor={visible ? NavbarColors.text : '#fff'}
            ios_backgroundColor="rgba(255,255,255,0.15)"
          />
        </View>
        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleSavePortfolio}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Save portfolio</Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>Photos</Text>
        <Pressable
          style={[
            styles.secondaryButton,
            uploadingPhoto && styles.buttonDisabled,
          ]}
          onPress={handleAddPhoto}
          disabled={uploadingPhoto}>
          {uploadingPhoto ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>Add photo</Text>
          )}
        </Pressable>

        {photos.length === 0 ? (
          <Text style={styles.emptyText}>No photos yet.</Text>
        ) : (
          <View style={styles.photosGrid}>
            {photos.map((photo) => {
              const uri = uploadsUrl(photo.url);
              if (!uri) return null;
              return (
                <Pressable
                  key={photo.id}
                  style={styles.photoThumbWrap}
                  onPress={() => openPhotoEditor(photo)}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  {photo.caption ? (
                    <Text style={styles.photoCaption} numberOfLines={1}>
                      {photo.caption}
                    </Text>
                  ) : (
                    <Text style={styles.photoCaptionMuted} numberOfLines={1}>
                      Add caption
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalBackdropPress}
            onPress={() => setSelectedPhoto(null)}
          />
          <View style={styles.modalContent}>
            {selectedPhoto ? (
              <>
                {uploadsUrl(selectedPhoto.url) ? (
                  <Image
                    source={{ uri: uploadsUrl(selectedPhoto.url) as string }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                ) : null}
                <Text style={styles.modalTitle}>Edit caption</Text>
                <TextInput
                  style={[styles.input, styles.modalInput]}
                  placeholder="Caption"
                  placeholderTextColor={NavbarColors.textMuted}
                  value={selectedPhotoCaption}
                  onChangeText={setSelectedPhotoCaption}
                />
                <View style={styles.modalButtonsRow}>
                  <Pressable
                    style={[
                      styles.secondaryButton,
                      (updatingPhoto || deletingPhoto) && styles.buttonDisabled,
                    ]}
                    disabled={updatingPhoto || deletingPhoto}
                    onPress={() => setSelectedPhoto(null)}>
                    <Text style={styles.secondaryButtonText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      updatingPhoto && styles.buttonDisabled,
                    ]}
                    disabled={updatingPhoto || deletingPhoto}
                    onPress={handleUpdatePhoto}>
                    {updatingPhoto ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Save caption
                      </Text>
                    )}
                  </Pressable>
                </View>
                <Pressable
                  style={[
                    styles.dangerButton,
                    deletingPhoto && styles.buttonDisabled,
                  ]}
                  disabled={deletingPhoto || updatingPhoto}
                  onPress={handleDeletePhoto}>
                  {deletingPhoto ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.dangerButtonText}>Delete photo</Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
// Define the styles for the manage portfolio screen
const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 4,
  },
  subtitle: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    marginBottom: 16,
  },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backButtonText: { color: NavbarColors.text, fontSize: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: NavbarColors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  error: { color: '#ff6b6b', marginBottom: 8, fontSize: 14 },
  status: { color: GradientColors.pinkLight, marginBottom: 8, fontSize: 14 },
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  toggleTextWrap: { flex: 1, paddingRight: 12 },
  toggleTitle: { color: NavbarColors.text, fontSize: 14, fontWeight: '600' },
  toggleSubtitle: { color: NavbarColors.textMuted, fontSize: 12, marginTop: 3 },
  primaryButton: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
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
  buttonDisabled: { opacity: 0.7 },
  emptyText: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 8,
  },
  photoThumbWrap: {
    width: '33.3333%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  photoThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    marginBottom: 4,
  },
  photoCaption: {
    color: NavbarColors.text,
    fontSize: 11,
  },
  photoCaptionMuted: {
    color: NavbarColors.textMuted,
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    padding: 16,
  },
  modalImage: {
    width: '100%',
    maxHeight: '50%',
    borderRadius: 10,
    marginBottom: 12,
  },
  modalTitle: {
    color: NavbarColors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    marginTop: 4,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  dangerButton: {
    backgroundColor: 'rgba(200,80,80,0.7)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerButtonText: { color: NavbarColors.text, fontSize: 15, fontWeight: '600' },
})

