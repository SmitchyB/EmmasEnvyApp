import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from the expo-image-picker library
import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter modules from the expo-router library
import React, { useEffect, useMemo, useState } from 'react'; // Import the React, useEffect, useMemo, and useState modules from the react library
import {
  ActivityIndicator, // Import the ActivityIndicator module from the react-native library
  Alert, // Import the Alert module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  ScrollView, // Import the ScrollView module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  TextInput, // Import the TextInput module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from the react-native-safe-area-context library 
import { PortfolioPickerModal } from '@/components/booking/PortfolioPickerModal'; // Import the PortfolioPickerModal module from the components/booking/PortfolioPickerModal file
import { StaffInspoQrModal } from '@/components/booking/StaffInspoQrModal'; // Import the StaffInspoQrModal module from the components/booking/StaffInspoQrModal file
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors module from the constants/theme file
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from the contexts/AuthContext file
import { useBookingData } from '@/contexts/BookingDataContext'; // Import the useBookingData module from the contexts/BookingDataContext file
import { createAppointment, fetchAppointmentAvailability, fetchPublicServiceTypes } from '@/lib/booking-api'; // Import the createAppointment, fetchAppointmentAvailability, and fetchPublicServiceTypes modules from the booking-api file
import type { ServiceType } from '@/lib/booking-types'; // Import the ServiceType type from the booking-types file
import { durationToMinutes } from '@/lib/booking-duration'; // Import the durationToMinutes module from the booking-duration file
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole module from the roles file
import { getPrimaryPortfolio } from '@/lib/portfolio-api'; // Import the getPrimaryPortfolio module from the portfolio-api file

const STEPS = ['Service', 'Date', 'Time', 'Contact', 'Notes', 'Inspiration'] as const; // Wizard step titles shown in the header label

//Function to format the date label
function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number); // Split the ymd string into an array of numbers
  const dt = new Date(y, m - 1, d); // Create a new Date object
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); // Return the date in the format of weekday, month, and day
}

//Function to get the upcoming date strings
function upcomingDateStrings(days: number): string[] {
  const out: string[] = []; // Initialize the out array
  const now = new Date(); // Create a new Date object
  // Loop through the days and add the date to the out array
  for (let i = 0; i < days; i++) {
    const d = new Date(now); // Create a new Date object
    d.setDate(d.getDate() + i); // Set the date to the date plus the index
    const y = d.getFullYear(); // Get the year
    const mo = String(d.getMonth() + 1).padStart(2, '0'); // Get the month
    const da = String(d.getDate()).padStart(2, '0'); // Get the day
    out.push(`${y}-${mo}-${da}`); // Push the date to the out array
  }
  return out; // Return the out array
}

// Screen: multi-step public booking flow (service → slot → contact → notes → inspiration)
export default function BookAppointmentScreen() {
  const insets = useSafeAreaInsets(); // Safe-area padding for header and footer
  const router = useRouter(); // Pop stack after successful book
  const { user, token } = useAuth(); // Optional session for client_id and availability auth
  const { refreshAppointments } = useBookingData(); // Invalidate cached lists after create
  const params = useLocalSearchParams<{ portfolioPhotoIds?: string }>(); // Deep link from portfolio picker
  const isStaff = isStaffRole(user?.role); // Staff see extra QR affordances after booking
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]); // Public catalog rows
  const [servicesLoading, setServicesLoading] = useState(true); // Initial catalog fetch flag
  const [slots, setSlots] = useState<string[]>([]); // HH:MM start labels from availability API
  const [slotsLoading, setSlotsLoading] = useState(false); // True while refetching slots for a day
  const [step, setStep] = useState(0); // Index into STEPS
  const [serviceId, setServiceId] = useState<number | null>(null); // Chosen service_type id
  const [date, setDate] = useState<string | null>(null); // YYYY-MM-DD from chip row
  const [time, setTime] = useState<string | null>(null); // Slot key matching server
  const [clientName, setClientName] = useState(''); // Contact step: display name
  const [clientEmail, setClientEmail] = useState(''); // Contact step: email
  const [clientPhone, setClientPhone] = useState(''); // Contact step: phone
  const [notes, setNotes] = useState(''); // Optional free text; defaults to service title
  const [inspoUris, setInspoUris] = useState<string[]>([]); // Local file or remote paths for upload
  const [portfolioOpen, setPortfolioOpen] = useState(false); // PortfolioPickerModal visibility
  const [staffQrOpen, setStaffQrOpen] = useState(false); // StaffInspoQrModal visibility
  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null); // New row id for QR modal
  const [lastCreatedInspoCount, setLastCreatedInspoCount] = useState(0); // Baseline count for QR copy text

  // Load bookable service types once on mount (public endpoint)
  useEffect(() => {
    let cancelled = false; // Ignore late responses after unmount
    (async () => {
      setServicesLoading(true); // Show spinner on step 0
      try {
        const list = await fetchPublicServiceTypes(); // Unauthenticated list
        if (!cancelled) setServiceTypes(list); // Commit rows
      } catch {
        if (!cancelled) setServiceTypes([]); // Empty state on failure
      } finally {
        if (!cancelled) setServicesLoading(false); // Clear spinner
      }
    })();
    return () => {
      cancelled = true; // Tear down guard
    };
  }, []);

  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === serviceId) ?? null, // Full row for duration and employee
    [serviceTypes, serviceId]
  );

  // Prefill contact fields when a logged-in user opens the flow
  useEffect(() => {
    if (!user) return; // Guest leaves fields blank
    const name = [user.first_name, user.last_name].filter(Boolean).join(' '); // Display name from profile
    if (name) setClientName(name); // Only overwrite when we have parts
    if (user.email) setClientEmail(user.email); // Copy verified email when present
    if (user.phone) setClientPhone(user.phone); // Copy phone when present
  }, [user]);

  // Merge portfolio photo URLs from navigation param into inspo list
  useEffect(() => {
    const raw = params.portfolioPhotoIds; // Comma-separated numeric ids
    if (!raw || typeof raw !== 'string') return; // No deep link payload
    (async () => {
      try {
        const primary = await getPrimaryPortfolio(); // Load stylist primary portfolio
        const ids = new Set(
          raw
            .split(',') // Tokenize ids
            .map((x) => parseInt(x.trim(), 10)) // Parse integers
            .filter((n) => !Number.isNaN(n)) // Drop junk
        );
        const paths =
          primary?.portfolio?.photos?.filter((p) => ids.has(p.id)).map((p) => p.url).filter(Boolean) as string[]; // Match selection
        if (paths?.length) setInspoUris((prev) => [...new Set([...prev, ...paths])]); // Dedupe merge
      } catch {
        // Ignore preload errors; user can still pick manually
      }
    })();
  }, [params.portfolioPhotoIds]);

  const dates = useMemo(() => upcomingDateStrings(45), []); // Next six weeks of YYYY-MM-DD chips

  // Refetch slot list whenever date or service changes
  useEffect(() => {
    if (!date || !serviceId) {
      setSlots([]); // Clear stale times when prerequisites missing
      return;
    }
    let cancelled = false; // Race guard
    (async () => {
      setSlotsLoading(true); // Spinner on time step
      try {
        const s = await fetchAppointmentAvailability({ date, serviceTypeId: serviceId }, token); // Server slots
        if (!cancelled) setSlots(s); // Apply result
      } catch {
        if (!cancelled) setSlots([]); // Fail to empty
      } finally {
        if (!cancelled) setSlotsLoading(false); // Always stop spinner
      }
    })();
    return () => {
      cancelled = true; // Cancel in-flight request
    };
  }, [date, serviceId, token]);

  const employeeId = selectedService?.employee_id; // Required on create; must match service owner

  // Function to validate the current step then advance the wizard
  const goNext = () => {
    // If the step is 0 and the service id is not set, show an alert
    if (step === 0 && !serviceId) {
      Alert.alert('Choose a service'); // Block without selection
      return;
    }
    // If the step is 1 and the date is not set, show an alert
    if (step === 1 && !date) {
      Alert.alert('Choose a date'); // Block without selection
      return;
    }
    // If the step is 2 and the time is not set, show an alert
    if (step === 2 && !time) {
      Alert.alert('Choose a time'); // Block without selection
      return;
    }
    // If the step is 3 and the client name is not set, show an alert
    if (step === 3) {
      // If the client name is not set, show an alert
      if (!clientName.trim()) {
        Alert.alert('Enter client name'); // Name required for invoice row
        return;
      }
      // If the client email and phone are not set, show an alert
      if (!clientEmail.trim() && !clientPhone.trim()) {
        Alert.alert('Enter email or phone'); // Need at least one contact channel
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1)); // Cap at last step
  };

  // Function to append one or more device photos to inspoUris after permission grant
  const pickDeviceImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); // iOS/Android gate
    // If the permission is not granted, show an alert
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach inspiration images.'); // Explain block
      return;
    }
    // Launch the image library async
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Still images only
      allowsMultipleSelection: true, // Batch attach
      quality: 0.85, // Balance size vs clarity
    });
    if (res.canceled || !res.assets?.length) return; // User dismissed picker
    const uris = res.assets.map((a) => a.uri).filter(Boolean); // Local content URIs
    setInspoUris((prev) => [...prev, ...uris]); // Append without dedupe (same file twice allowed)
  };

  // Function to POST the appointment then show role-specific success UI
  const submit = async () => {
    if (!selectedService || !date || !time) return; // Guard incomplete state
    if (employeeId == null) {
      Alert.alert('Unavailable', 'This service has no assigned stylist yet.'); // Cannot assign row
      return;
    }
    const desc = notes.trim() || selectedService.title; // Default description to service name
    // Try to create the appointment
    try {
      // Create the appointment
      const appointment = await createAppointment(
        {
          client_id: user?.id ?? null, // Link logged-in customer when present
          client_name: clientName.trim(), // Trim the client name
          client_email: clientEmail.trim() || null, // Trim the client email
          client_phone: clientPhone.trim() || null, // Trim the client phone
          employee_id: employeeId, // Stylist from service type
          date, // Set the date
          time, // Set the time
          description: desc, // Set the description
          inspo_pics: inspoUris.length ? inspoUris : null, // Optional multipart paths handled server-side
          service_type_id: selectedService.id, // Set the service type id
        },
        token
      );
      setLastCreatedId(appointment.id); // Drive QR modal and footer link
      setLastCreatedInspoCount(appointment.inspo_pics?.length ?? 0); // Count after server normalization
      await refreshAppointments(); // Sync tabs and context cache
      // If the user is a staff member, show an alert
      if (isStaff) {
        // Show an alert to the user that the appointment has been created
        Alert.alert('Appointment created', 'You can share the customer upload QR now, or close to finish.', [
          { text: 'Customer upload QR', onPress: () => setStaffQrOpen(true) }, // Set the staff qr open state to true
          { text: 'Done', onPress: () => router.back() }, // Go back to the previous screen
        ]);
      } else {
        // Show an alert to the user that the appointment has been created
        Alert.alert('Request sent', 'Your appointment is pending confirmation.', [
          { text: 'OK', onPress: () => router.back() }, // Go back to the previous screen
        ]);
      }
    } catch (e) {
      Alert.alert('Could not book', e instanceof Error ? e.message : 'Try another time.'); // Surface API message
    }
  };
  // Return the book appointment screen
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Book</Text>
        <View style={{ width: 48 }} />
      </View>
      <Text style={styles.stepLabel}>
        Step {step + 1}/{STEPS.length}: {STEPS[step]}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {step === 0 && servicesLoading ? (
          <ActivityIndicator size="large" color={NavbarColors.text} style={{ marginTop: 24 }} />
        ) : null}
        {step === 0 && !servicesLoading && serviceTypes.length === 0 ? (
          <Text style={styles.muted}>No bookable services are available yet.</Text>
        ) : null}
        {step === 0 && !servicesLoading && serviceTypes.length > 0 ? (
          <View style={styles.block}>
            {serviceTypes.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setServiceId(s.id)}
                style={[styles.card, serviceId === s.id && styles.cardOn]}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                {s.description ? <Text style={styles.cardSub}>{s.description}</Text> : null}
                <Text style={styles.cardMeta}>
                  {durationToMinutes(s.duration_needed)} min · ${s.price ?? 0}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 1 && (
          <View style={styles.wrapRow}>
            {dates.map((d) => (
              <Pressable key={d} onPress={() => { setDate(d); setTime(null); }} style={[styles.chip, date === d && styles.chipOn]}>
                <Text style={[styles.chipText, date === d && styles.chipTextOn]}>{formatDateLabel(d)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 2 && slotsLoading ? (
          <ActivityIndicator size="large" color={NavbarColors.text} style={{ marginTop: 24 }} />
        ) : null}
        {step === 2 && !slotsLoading ? (
          <View style={styles.wrapRow}>
            {slots.length === 0 ? (
              <Text style={styles.muted}>No openings this day for that service. Pick another date.</Text>
            ) : (
              slots.map((t) => (
                <Pressable key={t} onPress={() => setTime(t)} style={[styles.chip, time === t && styles.chipOn]}>
                  <Text style={[styles.chipText, time === t && styles.chipTextOn]}>{t}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="Full name"
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="Email"
              placeholderTextColor={NavbarColors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="Phone"
              placeholderTextColor={NavbarColors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.form}>
            <Text style={styles.label}>Notes for your stylist (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Style goals, allergies, etc."
              placeholderTextColor={NavbarColors.textMuted}
              multiline
            />
          </View>
        )}

        {step === 5 && (
          <View style={styles.form}>
            <Text style={styles.muted}>
              Add reference images from your device{isStaff ? '' : ' or from the portfolio'}.
            </Text>
            {!isStaff && (
              <Pressable style={styles.actionBtn} onPress={() => setPortfolioOpen(true)}>
                <Text style={styles.actionBtnText}>Choose from portfolio</Text>
              </Pressable>
            )}
            {isStaff && (
              <Pressable style={styles.actionBtn} onPress={() => setPortfolioOpen(true)}>
                <Text style={styles.actionBtnText}>Browse portfolio (modal)</Text>
              </Pressable>
            )}
            <Pressable style={styles.actionBtn} onPress={pickDeviceImages}>
              <Text style={styles.actionBtnText}>{isStaff ? 'Upload from this device' : 'Upload from device'}</Text>
            </Pressable>
            <Text style={styles.meta}>Selected: {inspoUris.length} image(s)</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable style={styles.secondaryFooter} onPress={() => setStep((s) => Math.max(0, s - 1))}>
            <Text style={styles.secondaryFooterText}>Previous</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {step < STEPS.length - 1 ? (
          <Pressable style={styles.primaryFooter} onPress={goNext}>
            <Text style={styles.primaryFooterText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryFooter} onPress={submit}>
            <Text style={styles.primaryFooterText}>Book appointment</Text>
          </Pressable>
        )}
      </View>

      {isStaff && lastCreatedId != null ? (
        <Pressable style={styles.qrLink} onPress={() => setStaffQrOpen(true)}>
          <Text style={styles.qrLinkText}>Open customer inspiration QR</Text>
        </Pressable>
      ) : null}

      <PortfolioPickerModal
        visible={portfolioOpen}
        onClose={() => setPortfolioOpen(false)}
        initialSelected={inspoUris.filter((u) => !u.startsWith('file:') && !u.startsWith('content:'))}
        onConfirm={(paths) => {
          setInspoUris((prev) => [...new Set([...prev, ...paths])]);
        }}
      />
      <StaffInspoQrModal
        visible={staffQrOpen}
        appointmentId={lastCreatedId}
        initialInspoCount={lastCreatedInspoCount}
        onClose={() => setStaffQrOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: NavbarColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
  },
  stepLabel: {
    color: NavbarColors.textMuted,
    marginBottom: 12,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  block: {
    gap: 10,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  cardOn: {
    borderColor: NavbarColors.text,
  },
  cardTitle: {
    color: NavbarColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardSub: {
    color: NavbarColors.textMuted,
    marginTop: 4,
    fontSize: 14,
  },
  cardMeta: {
    color: NavbarColors.textMuted,
    marginTop: 8,
    fontSize: 13,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  chipOn: {
    backgroundColor: 'rgba(233,30,99,0.35)',
    borderColor: NavbarColors.text,
  },
  chipText: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextOn: {
    color: NavbarColors.text,
  },
  muted: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  form: {
    gap: 8,
  },
  label: {
    color: NavbarColors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: NavbarColors.text,
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(233,30,99,0.35)',
    alignItems: 'center',
  },
  actionBtnText: {
    color: NavbarColors.text,
    fontWeight: '700',
  },
  meta: {
    marginTop: 12,
    color: NavbarColors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondaryFooter: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    alignItems: 'center',
  },
  secondaryFooterText: {
    color: NavbarColors.text,
    fontWeight: '600',
  },
  primaryFooter: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(194,24,91,0.9)',
    alignItems: 'center',
  },
  primaryFooterText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  qrLink: {
    marginTop: 10,
    alignItems: 'center',
  },
  qrLinkText: {
    color: NavbarColors.text,
    textDecorationLine: 'underline',
    fontSize: 14,
  },
});
