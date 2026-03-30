import { useFocusEffect } from '@react-navigation/native'; // Import the useFocusEffect hook from the react-navigation library
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, // Import the ActivityIndicator module from the react-native library
  Animated, // Import the Animated module from the react-native library
  Dimensions, // Import the Dimensions module from the react-native library
  FlatList, // Import the FlatList module from the react-native library
  Image, // Import the Image module from the react-native library
  LayoutAnimation, // Import the LayoutAnimation module from the react-native library
  Modal, // Import the Modal module from the react-native library
  Platform, // Import the Platform module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  TouchableOpacity, // Import the TouchableOpacity module from the react-native library
  UIManager, // Import the UIManager module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets hook from the react-native-safe-area-context library
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl function from the constants/config file
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors from the constants/theme file
import type { Portfolio, PortfolioPhoto } from '@/lib/portfolio-api';
import { getPortfolioById, getPortfolios } from '@/lib/portfolio-api';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'; // Import Gesture API so pinch and swipe share one native orchestrator

//If the platform is android and the UIManager is set to LayoutAnimationEnabledExperimental, set it to true
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Define the SelectedPhotoState type
type SelectedPhotoState = {
  portfolio: Portfolio;
  photos: PortfolioPhoto[];
  index: number;
} | null;

// Define the PortfoliosScreen component
export default function PortfoliosScreen() {
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const [loading, setLoading] = useState(true); // Set the loading state to true
  const [error, setError] = useState<string | null>(null); // Set the error state to null
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]); // Set the portfolios state to an empty array
  const [expandedId, setExpandedId] = useState<number | null>(null); // Set the expanded id state to null
  const [expandedPhotos, setExpandedPhotos] = useState<Record<number, PortfolioPhoto[]>>({}); // Set the expanded photos state to an empty object
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhotoState>(null); // Set the selected photo state to null

  // Define the loadPortfolios function
  const loadPortfolios = useCallback(async () => {
    setLoading(true); // Set the loading state to true
    setError(null); // Set the error state to null
    // Try to get the portfolios
    try {
      const { portfolios: list } = await getPortfolios(); // Get the portfolios
      setPortfolios(list.filter((p) => p.visible)); // Set the portfolios state to the filtered portfolios
      setExpandedId(null); // Set the expanded id state to null
      setSelectedPhoto(null); // Set the selected photo state to null
      setExpandedPhotos({}); // Set the expanded photos state to an empty object
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portfolios'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  }, []);

  // Define the useFocusEffect hook to load the portfolios when the screen is focused
  useFocusEffect(
    // Define the Callback function to load the portfolios when the screen is focused
    useCallback(() => {
      loadPortfolios(); // Load the portfolios
      return () => {
        setExpandedId(null); // Set the expanded id state to null
        setExpandedPhotos({}); // Set the expanded photos state to an empty object
        setSelectedPhoto(null); // Set the selected photo state to null
      };
    }, [loadPortfolios]) // Return the loadPortfolios function
  );
  // Define the toggleExpand function to toggle the expanded state of the portfolio
  const toggleExpand = async (portfolio: Portfolio) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // Configure the next layout animation to ease in and ease out
    // If the expanded id is the same as the portfolio id, set the expanded id to null
    if (expandedId === portfolio.id) {
      setExpandedId(null); // Set the expanded id state to null
      return; // Return
    }
    setExpandedId(portfolio.id); // Set the expanded id state to the portfolio id
    // If the expanded photos is not the same as the portfolio id, get the portfolio photos
    if (!expandedPhotos[portfolio.id]) {
      try {
        const { portfolio: withPhotos } = await getPortfolioById(portfolio.id); // Get the portfolio with photos
        setExpandedPhotos((prev) => ({ ...prev, [portfolio.id]: withPhotos.photos || [] })); // Set the expanded photos state to the portfolio photos
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load portfolio photos'); // Set the error state to the error message
      }
    }
  };

  // Define the handlePressPhoto function to handle the press of the photo
  const handlePressPhoto = (portfolio: Portfolio, photos: PortfolioPhoto[], photo: PortfolioPhoto) => {
    const index = photos.findIndex((p) => p.id === photo.id); // Find the index of the photo in the photos array
    if (index === -1) return; // If the index is -1, return
    setSelectedPhoto({ portfolio, photos, index }); // Set the selected photo state to the portfolio, photos, and index
  };

  // Define the renderItem function to render the item
  const renderItem = ({ item }: { item: Portfolio }) => {
    const isExpanded = expandedId === item.id; // Set the is expanded state to the expanded id is the same as the item id
    const photos = expandedPhotos[item.id] ?? []; // Set the photos state to the expanded photos is the same as the item id
    const portraitUrl = uploadsUrl(item.portrait); // Set the portrait url state to the uploads url of the item portrait
    //Return the card container with the card, card header, card footer, and photos section
    return (
      <View style={styles.cardContainer}>
        <Pressable onPress={() => toggleExpand(item)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
          <View style={styles.cardHeader}>
            {portraitUrl ? (
              <Image source={{ uri: portraitUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.headerTextWrap}>
              <Text style={styles.cardTitle}>{item.name || 'Portfolio'}</Text>
              {item.description ? <Text style={styles.cardBio} numberOfLines={2}>{item.description}</Text> : null}
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.footerText}>{isExpanded ? 'Hide photos' : 'View photos'}</Text>
            <View style={styles.bookNowPill}>
              <Text style={styles.bookNowText}>Book now</Text>
            </View>
          </View>
        </Pressable>
        {isExpanded && (
          <View style={styles.photosSection}>
            {photos.length === 0 ? (
              <Text style={styles.emptyPhotosText}>No photos yet.</Text>
            ) : (
              <View style={styles.photosGrid}>
                {photos.map((photo) => {
                  const uri = uploadsUrl(photo.url);
                  if (!uri) return null;
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={styles.photoThumbWrap}
                      onPress={() => handlePressPhoto(item, photos, photo)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri }} style={styles.photoThumb} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };
  // If the loading state is true and the portfolios state is empty and the error state is null, return the centered view with the activity indicator
  if (loading && !portfolios.length && !error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <ActivityIndicator size="large" color={NavbarColors.text} />
      </View>
    );
  }
  // Return the screen with the header, error, flat list, and photo viewer modal
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Portfolios</Text>
        <Text style={styles.screenSubtitle}>Explore our work and artists.</Text>
      </View>
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadPortfolios}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={portfolios}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      <PhotoViewerModal selected={selectedPhoto} setSelected={setSelectedPhoto} />
    </View>
  );
}

// Define the PhotoViewerModalProps type
type PhotoViewerModalProps = {
  selected: SelectedPhotoState;
  setSelected: (s: SelectedPhotoState) => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window'); // Get the screen width and height
const SWIPE_THRESHOLD = 50; // Set the swipe threshold to 50
const SWIPE_HINT_VISIBLE_MS = 2200; // Set the swipe hint visible milliseconds to 2200
const MIN_ZOOM = 1; // Set the minimum zoom to 1
const MAX_ZOOM = 3; // Set the maximum zoom to 3
const SWIPE_MAX_ZOOM_FOR_NAV = 1.01; // Disable swiping once the user has zoomed in.
// Define the PhotoViewerModal component with the selected and setSelected props
function PhotoViewerModal({ selected, setSelected }: PhotoViewerModalProps) {
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const [showSwipeHint, setShowSwipeHint] = React.useState(false); // Set the show swipe hint state to false
  const [showZoomHint, setShowZoomHint] = React.useState(false); // Set the show zoom hint state to false
  const hintOpacity = React.useRef(new Animated.Value(0)).current; // Set the hint opacity state to the new animated value of 0 
  const zoomHintOpacity = React.useRef(new Animated.Value(0)).current; // Set the zoom hint opacity state to the new animated value of 0 
  const hintTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null); // Set the hint timeout state to the new timeout of null
  const zoomHintTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null); // Set the zoom hint timeout state to the new timeout of null
  const hintShownForThisOpen = React.useRef(false); // Set the hint shown for this open state to false
  const isViewerOpen = Boolean(selected); // Set the is viewer open state to the boolean of the selected state
  const zoomScale = React.useRef(new Animated.Value(MIN_ZOOM)).current; // Set the zoom scale state to the new animated value of the minimum zoom
  const zoomScaleRef = React.useRef(MIN_ZOOM); // Set the zoom scale ref state to the minimum zoom
  const pinchStartScaleRef = React.useRef(MIN_ZOOM); // Set the pinch start scale ref state to the minimum zoom
  // Define the resetZoom function to reset the zoom
  const resetZoom = React.useCallback(() => {
    zoomScaleRef.current = MIN_ZOOM; // Set the zoom scale ref state to the minimum zoom
    zoomScale.setValue(MIN_ZOOM); // Set the zoom scale state to the minimum zoom
    pinchStartScaleRef.current = MIN_ZOOM; // Set the pinch start scale ref state to the minimum zoom
  }, [zoomScale]); // Return the zoom scale state
  // Define the dismissHintsNow function to dismiss the hints now
  const dismissHintsNow = React.useCallback(() => {
    // If the hint timeout is not null, clear the timeout and set the hint timeout to null
    if (hintTimeout.current) {
      clearTimeout(hintTimeout.current); // Clear the timeout and set the hint timeout to null
      hintTimeout.current = null; // Set the hint timeout to null
    }
    // If the zoom hint timeout is not null, clear the timeout and set the zoom hint timeout to null
    if (zoomHintTimeout.current) {
      clearTimeout(zoomHintTimeout.current); // Clear the timeout and set the zoom hint timeout to null
      zoomHintTimeout.current = null; // Set the zoom hint timeout to null
    }
    hintOpacity.stopAnimation(); // Stop the hint opacity animation
    hintOpacity.setValue(0); // Set the hint opacity state to 0
    zoomHintOpacity.stopAnimation(); // Stop the zoom hint opacity animation
    zoomHintOpacity.setValue(0); // Set the zoom hint opacity state to 0
    setShowSwipeHint(false); // Set the show swipe hint state to false
    setShowZoomHint(false); // Set the show zoom hint state to false
  }, [hintOpacity, zoomHintOpacity]); // Return the hint opacity and zoom hint opacity

  // Define the setZoomScaleClamped function to set the zoom scale clamped
  const setZoomScaleClamped = React.useCallback(
    (nextScale: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale)); // Set the clamped state to the maximum of the minimum zoom and the minimum of the maximum zoom and the next scale
      zoomScaleRef.current = clamped; // Set the zoom scale ref state to the clamped state
      zoomScale.setValue(clamped); // Set the zoom scale state to the clamped state
    },
    [zoomScale] // Return the zoom scale state
  );
  // Define the useEffect hook to handle the viewer open state
  React.useEffect(() => {
    // If the is viewer open state is false, set the hint shown for this open state to false, clear the timeout and set the hint timeout to null, clear the zoom hint timeout and set the zoom hint timeout to null, set the hint opacity state to 0, and set the zoom hint opacity state to 0
    if (!isViewerOpen) {
      hintShownForThisOpen.current = false; // Set the hint shown for this open state to false
      if (hintTimeout.current) clearTimeout(hintTimeout.current); // Clear the timeout and set the hint timeout to null
      hintTimeout.current = null; // Set the hint timeout to null
      if (zoomHintTimeout.current) clearTimeout(zoomHintTimeout.current); // Clear the timeout and set the zoom hint timeout to null
      zoomHintTimeout.current = null; // Set the zoom hint timeout to null
      hintOpacity.setValue(0); // Set the hint opacity state to 0
      zoomHintOpacity.setValue(0); // Set the zoom hint opacity state to 0
      setShowSwipeHint(false); // Set the show swipe hint state to false
      setShowZoomHint(false); // Set the show zoom hint state to false
      resetZoom(); // Reset the zoom
      return; // Return
    }
    // If the hint shown for this open state is true, return
    if (hintShownForThisOpen.current) return; // Return
    hintShownForThisOpen.current = true; // Set the hint shown for this open state to true
    setShowSwipeHint(true); // Set the show swipe hint state to true
    setShowZoomHint(true); // Set the show zoom hint state to true
    hintOpacity.setValue(0); // Set the hint opacity state to 0
    Animated.timing(hintOpacity, { toValue: 0.9, duration: 300, useNativeDriver: true }).start(); // Start the hint opacity animation
    // If the hint timeout is not null, clear the timeout and set the hint timeout to null
    if (hintTimeout.current) clearTimeout(hintTimeout.current); // Clear the timeout and set the hint timeout to null
    // Set the hint timeout to the setTimeout function
    hintTimeout.current = setTimeout(() => {
      hintTimeout.current = null; // Set the hint timeout to null
      dismissHintsNow(); // Dismiss the hints now
    }, SWIPE_HINT_VISIBLE_MS); // Set the swipe hint visible milliseconds to 2200
    zoomHintOpacity.setValue(0); // Set the zoom hint opacity state to 0
    Animated.timing(zoomHintOpacity, { toValue: 0.9, duration: 300, useNativeDriver: true }).start(); // Start the zoom hint opacity animation
    if (zoomHintTimeout.current) clearTimeout(zoomHintTimeout.current); // If the zoom hint timeout is not null, clear the timeout and set the zoom hint timeout to null
    // Set the zoom hint timeout to the setTimeout function
    zoomHintTimeout.current = setTimeout(() => {
      zoomHintTimeout.current = null; // Set the zoom hint timeout to null
      dismissHintsNow(); // Dismiss the hints now
    }, SWIPE_HINT_VISIBLE_MS); // Set the swipe hint visible milliseconds to 2200
    // Return the function to clear the timeout and set the hint timeout to null and the zoom hint timeout to null
    return () => {
      if (hintTimeout.current) clearTimeout(hintTimeout.current); // If the hint timeout is not null, clear the timeout and set the hint timeout to null
      if (zoomHintTimeout.current) clearTimeout(zoomHintTimeout.current); // If the zoom hint timeout is not null, clear the timeout and set the zoom hint timeout to null
    };
  }, [
    isViewerOpen, // Return the is viewer open state
    dismissHintsNow, // Return the dismiss hints now function
    hintOpacity, // Return the hint opacity state
    zoomHintOpacity, // Return the zoom hint opacity state
    resetZoom, // Return the reset zoom function
  ]);

  // Pinch + swipe gesture for the photo viewer modal
  const viewerGesture = React.useMemo(() => {
    // If the selected state is null, return the pan gesture with the enabled false and the run on js true
    if (!selected) {
      return Gesture.Pan().enabled(false).runOnJS(true);
    }
    const { index, photos } = selected; // Set the index and photos state to the selected state
    const canPrev = index > 0; // Set the can prev state to the index is greater than 0
    const canNext = index < photos.length - 1; // Set the can next state to the index is less than the photos length minus 1

    // Define the pinch gesture for the photo viewer modal
    const pinch = Gesture.Pinch()
      .runOnJS(true) // Run the gesture on js true
      // On start, set the pinch start scale ref to the current zoom scale ref and dismiss the hints now
      .onStart(() => {
        pinchStartScaleRef.current = zoomScaleRef.current; // Set the pinch start scale ref to the current zoom scale ref
        dismissHintsNow(); // Dismiss the hints now
      })
      // On update, set the zoom scale clamped to the pinch start scale ref times the scale
      .onUpdate((e) => {
        setZoomScaleClamped(pinchStartScaleRef.current * e.scale); // Set the zoom scale clamped to the pinch start scale ref times the scale
      })
      // On end, if the zoom scale ref is less than or equal to 1.05, reset the zoom
      .onEnd(() => {
        // If the zoom scale ref is less than or equal to 1.05, reset the zoom
        if (zoomScaleRef.current <= 1.05) {
          resetZoom(); // Reset the zoom
        }
      });
    // Define the pan gesture for the photo viewer modal
    const pan = Gesture.Pan()
      .runOnJS(true) // Run the gesture on js true
      .maxPointers(1) // Set the max pointers to 1
      .minPointers(1) // Set the min pointers to 1
      .activeOffsetX([-18, 18]) // Set the active offset x to the -18 and 18
      .failOffsetY([-48, 48]) // Set the fail offset y to the -48 and 48
      // On start, dismiss the hints now
      .onStart(() => {
        dismissHintsNow();
      })
      // On end, if the zoom scale ref is greater than the swipe max zoom for nav, return
      .onEnd((e) => {
        if (zoomScaleRef.current > SWIPE_MAX_ZOOM_FOR_NAV) return; // If the zoom scale ref is greater than the swipe max zoom for nav, return
        const tx = e.translationX; // Set the tx state to the translation x of the event
        // If the tx is less than the -swipe threshold and the can next state is true, reset the zoom and set the selected state to the selected state with the index plus 1
        if (tx < -SWIPE_THRESHOLD && canNext) { 
          resetZoom(); // Reset the zoom
          setSelected({ ...selected, index: index + 1 }); // Set the selected state to the selected state with the index plus 1
        } else if (tx > SWIPE_THRESHOLD && canPrev) { // If the tx is greater than the swipe threshold and the can prev state is true, reset the zoom and set the selected state to the selected state with the index minus 1
          resetZoom(); // Reset the zoom
          setSelected({ ...selected, index: index - 1 }); // Set the selected state to the selected state with the index minus 1
        }
      }); // Return the gesture detector with the pinch and pan gestures
    return Gesture.Simultaneous(pinch, pan); // Return the simultaneous gesture with the pinch and pan gestures
  }, [selected, dismissHintsNow, setZoomScaleClamped, resetZoom, setSelected]); // Return the selected state, dismiss hints now function, set zoom scale clamped function, reset zoom function, and set selected function

  if (!selected) return null; // If the selected state is null, return null
  const { portfolio, photos, index } = selected; // Set the portfolio, photos, and index state to the selected state
  const photo = photos[index]; // Set the photo state to the photos at the index
  if (!photo) return null; // If the photo is null, return null
  const uri = uploadsUrl(photo.url); // Set the uri state to the uploads url of the photo url
  const close = () => setSelected(null); // Set the close function to the setSelected function with the null state
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.viewerBackdrop}>
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <GestureDetector gesture={viewerGesture}>
            <Animated.View style={[styles.viewerImageScaleWrap, { transform: [{ scale: zoomScale }] }]} collapsable={false}>
              {uri ? (
                <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
              ) : (
                <View style={styles.viewerImagePlaceholder} />
              )}
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
        {showSwipeHint && (
          <Animated.View style={[styles.viewerSwipeHint, { opacity: hintOpacity }]} pointerEvents="none" collapsable={false}>
            <View style={styles.viewerSwipeHintPill}>
              <Text style={styles.viewerSwipeHintArrows}>‹  ›</Text>
              <Text style={styles.viewerSwipeHintLabel}>Swipe to see more</Text>
            </View>
          </Animated.View>
        )}
        {showZoomHint && (
          <Animated.View style={[styles.viewerZoomHint, { opacity: zoomHintOpacity }]} pointerEvents="none" collapsable={false}>
            <View style={styles.viewerSwipeHintPill}>
              <Text style={styles.viewerSwipeHintArrows}>+  -</Text>
              <Text style={styles.viewerSwipeHintLabel}>Pinch to zoom</Text>
            </View>
          </Animated.View>
        )}
        <Pressable style={[styles.viewerCloseBtn, { top: insets.top + 12 }]} onPress={close} hitSlop={12}>
          <Text style={styles.viewerCloseText}>✕</Text>
        </Pressable>
        <View style={[styles.viewerOverlay, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.viewerCaptionRow}>
            <Text style={styles.viewerCaptionTitle} numberOfLines={1}>{portfolio.name || 'Portfolio'}</Text>
            {photo.caption ? (
              <Text style={styles.viewerCaptionBody} numberOfLines={3}>{photo.caption}</Text>
            ) : (
              <Text style={styles.viewerCaptionMuted}>No caption</Text>
            )}
          </View>
          <Text style={styles.viewerIndex}>{index + 1} / {photos.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

// Define the styles
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: NavbarColors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: NavbarColors.textMuted,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    backgroundColor: GradientColors.pinkDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: NavbarColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTextWrap: {
    flex: 1,
  },
  cardTitle: {
    color: NavbarColors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardBio: {
    color: NavbarColors.textMuted,
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  footerText: {
    color: NavbarColors.textMuted,
    fontSize: 13,
  },
  bookNowPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: GradientColors.pinkDark,
  },
  bookNowText: {
    color: NavbarColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  photosSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 10,
  },
  emptyPhotosText: {
    color: NavbarColors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
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
  },
  errorWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  retryText: {
    color: NavbarColors.text,
    fontSize: 13,
  },
  viewerBackdrop: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  viewerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  viewerImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  viewerImageScaleWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  viewerSwipeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
    transform: [{ translateY: -72 }],
  },
  viewerZoomHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 19,
    pointerEvents: 'none',
    transform: [{ translateY: 72 }],
  },
  viewerSwipeHintPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerSwipeHintArrows: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 10,
    marginBottom: 2,
  },
  viewerSwipeHintLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '500',
  },
  viewerCloseBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  viewerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  viewerCaptionRow: {
    marginBottom: 6,
  },
  viewerCaptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  viewerCaptionBody: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
  },
  viewerCaptionMuted: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  viewerIndex: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
});
