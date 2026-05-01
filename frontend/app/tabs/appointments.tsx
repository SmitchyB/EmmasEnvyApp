import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from the expo-image-picker library
import { useFocusEffect } from '@react-navigation/native'; // Import the useFocusEffect module from the react-navigation library
import { useRouter } from 'expo-router'; // Import the useRouter module from the expo-router library
import React, { useCallback, useEffect, useMemo, useState } from 'react'; // Import the React, useCallback, useEffect, useMemo, and useState modules from the react library
import {
  ActivityIndicator, // Import the ActivityIndicator module from the react-native library 
  Alert, // Import the Alert module from the react-native library
  Dimensions, // Import the Dimensions module from the react-native library
  Image, // Import the Image module from the react-native library
  Modal, // Import the Modal module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  ScrollView, // Import the ScrollView module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from the react-native-safe-area-context library
import { AppointmentPhotoGalleryModal } from '@/components/booking/AppointmentPhotoGalleryModal'; // Import the AppointmentPhotoGalleryModal module from the components/booking/AppointmentPhotoGalleryModal file
import { PortfolioPickerModal } from '@/components/booking/PortfolioPickerModal'; // Import the PortfolioPickerModal module from the components/booking/PortfolioPickerModal file
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl module from the constants/config file
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors module from the constants/theme file
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from the contexts/AuthContext file
import { useBookingData } from '@/contexts/BookingDataContext'; // Import the useBookingData module from the contexts/BookingDataContext file
import {
  cancelAppointmentApi, // Import the cancelAppointmentApi module from the booking-api file
  fetchAppointmentAvailability, // Import the fetchAppointmentAvailability module from the booking-api file
  fetchPublicServiceTypes, // Import the fetchPublicServiceTypes module from the booking-api file
  updateAppointment, // Import the updateAppointment module from the booking-api file
  afterPhotoFilePart, // Import the afterPhotoFilePart module from the booking-api file
  uploadAppointmentFinishedPhoto, // Import the uploadAppointmentFinishedPhoto module from the booking-api file
} from '@/lib/booking-api';
import type { Appointment, ServiceType } from '@/lib/booking-types'; // Import the Appointment and ServiceType types from the booking-types file
import { STATUS_CANCELED } from '@/lib/booking-constants'; // Import the STATUS_CANCELED module from the booking-constants file
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole module from the roles file

const BUSINESS_TZ = 'America/Denver'; // Import the BUSINESS_TZ module from the booking-constants file
const DETAIL_MODAL_MAX_SCROLL = Math.round(Dimensions.get('window').height * 0.72); // Import the DETAIL_MODAL_MAX_SCROLL module from the booking-constants file

//Function to parse the appointment minutes
function parseAppointmentMinutes(timeStr: string): number {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/); // Match the time string to the pattern HH:MM
  if (!m) return 0; // If the time string does not match the pattern, return 0
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10); // Return the minutes
}

//Function to get the current time in the business timezone
function nowInBusinessTz(): { ymd: string; minutes: number } {
  const d = new Date(); // Create a new Date object
  const ymd = d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ }); // Get the date in the business timezone
  const hm = d.toLocaleTimeString('en-GB', {
    timeZone: BUSINESS_TZ, // Set the time zone to the business timezone
    hour: '2-digit', // Set the hour to the 2-digit format
    minute: '2-digit', // Set the minute to the 2-digit format
    hour12: false, // Set the hour12 to false
  });
  const [hh, mm] = hm.split(':').map((x) => parseInt(x, 10)); // Split the time string into hours and minutes
  return { ymd, minutes: (hh || 0) * 60 + (mm || 0) }; // Return the minutes
}

// Function to normalize the appointment date to YYYY-MM-DD
function normalizeAppointmentYmd(dateRaw: string | null | undefined): string {
  if (dateRaw == null) return ''; // If the date string is null, return an empty string
  const s = String(dateRaw).trim(); // Trim the date string
  const isoDay = s.match(/^(\d{4}-\d{2}-\d{2})/); // Match the date string to the pattern YYYY-MM-DD
  if (isoDay) return isoDay[1]; // If the date string matches the pattern, return the date
  const d = new Date(s); // Create a new Date object
  // If the date is not a number, return the date string
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ }); // Get the date in the business timezone
  }
  return s;
}

// Function to format the appointment date to Month Day, Year
function formatAppointmentDate(dateRaw: string): string {
  const ymd = normalizeAppointmentYmd(dateRaw); // Normalize the date string
  const [y, mo, d] = ymd.split('-').map(Number); // Split the date string into year, month, and day
  if (!y || !mo || !d) return ymd || String(dateRaw); // If the date string does not match the pattern, return the date string
  const refUtc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)); // Create a new Date object
  // Return the date in the business timezone
  return refUtc.toLocaleDateString('en-US', {
    month: 'long', // Set the month to the long format
    day: 'numeric', // Set the day to the numeric format
    year: 'numeric', // Set the year to the numeric format
    timeZone: BUSINESS_TZ, // Set the time zone to the business timezone
  });
}

// Function to format the appointment time to Hour:Minute AM/PM
function formatAppointmentTimeLabel(timeStr: string): string {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/); // Match the time string to the pattern HH:MM 
  if (!m) return timeStr; // If the time string does not match the pattern, return the time string
  const hh = parseInt(m[1], 10); // Parse the hours
  const min = m[2]; // Parse the minutes
  const d = new Date(Date.UTC(2000, 0, 1, hh, parseInt(min, 10), 0)); // Create a new Date object
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }); // Return the time in the UTC timezone
}

//Function to check if the appointment is canceled
function isCanceled(a: Appointment): boolean {
  // Return true if the appointment status is canceled
  return a.status === STATUS_CANCELED;
}

//Function to check if the appointment is complete
function isServiceComplete(a: Appointment): boolean {
  if (a.completed_at != null && String(a.completed_at).trim() !== '') return true; // If the completed at date is not null and the completed at date is not an empty string, return true
  // Get the status string and convert it to lowercase
  const s = String(a.status ?? '')
    .trim() // Trim the status string
    .toLowerCase(); // Convert the status string to lowercase
  return s === 'complete' || s === 'completed'; // Return true if the status is complete or completed
}
//Function to check if the appointment is paid
function isPaidAppointment(a: Appointment): boolean {
  if (a.paid_at) return true; // If the paid at date is not null, return true
  if (a.invoice_payment_status === 'Paid') return true; // If the invoice payment status is paid, return true
  return a.status === 'Paid'; // If the status is paid, return true
}

//Function to format the workflow timestamp
function formatWorkflowTs(iso: string | null | undefined): string {
  if (!iso) return '—'; // If the ISO date is not null, return the ISO date
  // Try to parse the ISO date
  try {
    const d = new Date(iso); // Create a new Date object
    // Return the date in the business timezone
    return d.toLocaleString('en-US', {
      month: 'short', // Set the month to the short format
      day: 'numeric', // Set the day to the numeric format
      hour: 'numeric', // Set the hour to the numeric format
      minute: '2-digit', // Set the minute to the 2-digit format
      timeZone: BUSINESS_TZ, // Set the time zone to the business timezone
    });
  } catch {
    return '—';
  }
}

//Function to get the inspiration thumbnail source URI  
function inspoThumbSourceUri(stored: string): string | null {
  const u = String(stored).trim(); // Trim the stored string
  if (!u) return null; // If the stored string is not null, return null
  // If the stored string is a valid URL, return the stored string
  if (/^https?:\/\//i.test(u) || u.startsWith('file:') || u.startsWith('content:')) {
    return u; // If the stored string is a valid URL, return the stored string
  }
  return uploadsUrl(u); // Return the uploads URL
}

// Function to check if the appointment is past the start time
function isPastStart(a: Appointment): boolean {
  const now = nowInBusinessTz(); // Get the current time in the business timezone
  const ymd = normalizeAppointmentYmd(a.date); // Normalize the appointment date
  if (!ymd) return false; // If the appointment date is not null, return false
  if (ymd < now.ymd) return true; // If the appointment date is before the current date, return true
  if (ymd > now.ymd) return false; // If the appointment date is after the current date, return false
  return parseAppointmentMinutes(a.time) < now.minutes; // If the appointment time is before the current time, return true
}

//Function to get the customer inspiration lock message
function customerInspoLockMessage(a: Appointment): string | null {
  if (isCanceled(a)) return null; // If the appointment is canceled, return null
  if (isServiceComplete(a)) return 'Inspiration photos cannot be changed after this visit is complete.'; // If the appointment is complete, return the inspiration photos cannot be changed after this visit is complete message
  if (isPaidAppointment(a)) return 'Inspiration photos cannot be changed for a paid appointment.'; // If the appointment is paid, return the inspiration photos cannot be changed for a paid appointment message
  if (isPastStart(a)) return 'Inspiration photos cannot be changed after your appointment start time.'; // If the appointment is past the start time, return the inspiration photos cannot be changed after your appointment start time message
  return null; // If the appointment is not canceled, complete, paid, or past the start time, return null
}

//Function to sort the appointments
function sortAppointments(list: Appointment[]): Appointment[] {
  return [...list].sort((a, b) => { // Sort the appointments by date and time
    const da = normalizeAppointmentYmd(a.date).localeCompare(normalizeAppointmentYmd(b.date)); // Compare the appointment dates
    if (da !== 0) return da; // If the appointment dates are not equal, return the comparison result
    return a.time.localeCompare(b.time); // Compare the appointment times
  }); // Return the sorted appointments
}

//Function to get the appointments tab screen
export default function AppointmentsTabScreen() {
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router
  const { user, token } = useAuth(); // Get the user and token
  const { appointments, refreshAppointments, loading } = useBookingData(); // Get the appointments, refreshAppointments, and loading

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]); // Get the service types

  //useEffect to fetch the service types
  useEffect(() => {
    let c = false; // Set the cancelled flag to false
    // Async function to fetch the service types
    (async () => {
      // Try to fetch the service types
      try {
        const st = await fetchPublicServiceTypes(); // Fetch the service types
        if (!c) setServiceTypes(st); // If the cancelled flag is false, set the service types
      } catch {
        if (!c) setServiceTypes([]); // If the cancelled flag is false, set the service types to an empty array
      }
    })();
    // Return a function to set the cancelled flag to true
    return () => {
      c = true; // Set the cancelled flag to true
    };
  }, []);

  //useFocusEffect to refresh the appointments
  useFocusEffect(
    useCallback(() => {
      refreshAppointments(); // Refresh the appointments
    }, [refreshAppointments]) // Return a function to refresh the appointments
  );

  const isStaff = isStaffRole(user?.role); // Check if the user is a staff member
  const openSupportForAppointment = useCallback(
    (a: Appointment) => {
      if (!user) return;
      router.push({
        pathname: '/support/create',
        params: {
          linkedAppointmentId: String(a.id),
          prefillIssueType: 'appointment_change_policy',
        },
      });
    },
    [user, router]
  );
  const list = useMemo(() => sortAppointments(appointments), [appointments]); // Sort the appointments
  const [detail, setDetail] = useState<Appointment | null>(null); // Set the detail state to null
  const [rescheduleOpen, setRescheduleOpen] = useState(false); // Set the reschedule open state to false
  const [resDate, setResDate] = useState<string | null>(null); // Set the reschedule date state to null
  const [resTime, setResTime] = useState<string | null>(null); // Set the reschedule time state to null
  const [resSlots, setResSlots] = useState<string[]>([]); // Set the reschedule slots state to an empty array
  const [resSlotsLoading, setResSlotsLoading] = useState(false); // Set the reschedule slots loading state to false
  const [inspoOpen, setInspoOpen] = useState(false); // Set the inspiration open state to false
  const [staffInspoGalleryOpen, setStaffInspoGalleryOpen] = useState(false); // Set the staff inspiration gallery open state to false
  const [staffAfterGalleryOpen, setStaffAfterGalleryOpen] = useState(false); // Set the staff after gallery open state to false
  const payStatus = detail?.invoice_payment_status ?? '—'; // Get the payment status
  // Get the service title
  const serviceTitle =
    // If the service type title is not null and the service type title is not an empty string, return the service type title
    (detail?.service_type_title && String(detail.service_type_title).trim()) || 
    // If the service type id is not null, return the service type title
    (detail?.service_type_id ? serviceTypes.find((s) => s.id === detail.service_type_id)?.title : null) ||
    // If the service type id is null, return the service title
    'Service';

  //useEffect to fetch the reschedule slots
  useEffect(() => {
    // If the reschedule date is not null, the service type id is not null, and the token is not null, set the reschedule slots to an empty array
    if (!resDate || !detail?.service_type_id || !token) {
      setResSlots([]); // Set the reschedule slots to an empty array
      return;
    }
    let cancelled = false; // Set the cancelled flag to false
    // Async to fetch the reschedule slots
    (async () => {
      setResSlotsLoading(true); // Set the reschedule slots loading state to true
      // Try to fetch the reschedule slots
      try {
        // Fetch the reschedule slots
        const s = await fetchAppointmentAvailability(
          {
            date: resDate, // Set the reschedule date
            serviceTypeId: detail.service_type_id!, // Set the service type id
            ignoreAppointmentId: detail.id, // Set the ignore appointment id
          },
          token // Set the token
        );
        if (!cancelled) setResSlots(s); // If the cancelled flag is false, set the reschedule slots
      } catch {
        if (!cancelled) setResSlots([]); // If the cancelled flag is false, set the reschedule slots to an empty array
      } finally {
        if (!cancelled) setResSlotsLoading(false); // If the cancelled flag is false, set the reschedule slots loading state to false
      }
    })();
    return () => {
      cancelled = true; // Set the cancelled flag to true
    };
  }, [resDate, detail?.id, detail?.service_type_id, token]); // Return a function to set the cancelled flag to true
  //Function to open the reschedule modal
  const openReschedule = (a: Appointment) => {
    setDetail(a); // Set the detail state to the appointment
    setResDate(normalizeAppointmentYmd(a.date) || a.date); // Set the reschedule date to the appointment date
    setResTime(a.time); // Set the reschedule time to the appointment time
    setRescheduleOpen(true); // Set the reschedule open state to true
  };
  //Function to apply the reschedule
  const applyReschedule = async () => {
    if (!detail || !resDate || !resTime || !token) return; // If the detail is not null, the reschedule date is not null, the reschedule time is not null, and the token is not null, return
    // If the reschedule time is not in the reschedule slots, return
    if (!resSlots.includes(resTime)) {
      Alert.alert('Time unavailable', 'Pick another slot from the list.'); //Set the alert to the time unavailable message
      return;
    }
    // Try to update the appointment
    try {
      const updated = await updateAppointment(token, detail.id, { date: resDate, time: resTime }); // Update the appointment
      await refreshAppointments(); // Refresh the appointments
      setRescheduleOpen(false); // Set the reschedule open state to false
      setDetail(updated); // Set the detail state to the updated appointment
    } catch (e) {
      Alert.alert('Could not reschedule', e instanceof Error ? e.message : 'Try again.'); // Set the alert to the could not reschedule message
    }
  };

  //Function to get the next 45 days
  const nextDates = useMemo(() => {
    const out: string[] = []; // Set the out array to an empty array
    const now = new Date(); // Create a new Date object
    // Loop through the next 45 days
    for (let i = 0; i < 45; i++) {
      const d = new Date(now); // Create a new Date object
      d.setDate(d.getDate() + i); // Set the date to the current date plus the number of days
      const y = d.getFullYear(); // Get the year
      const mo = String(d.getMonth() + 1).padStart(2, '0'); // Get the month
      const da = String(d.getDate()).padStart(2, '0'); // Get the day
      out.push(`${y}-${mo}-${da}`); // Push the date to the out array
    }
    return out; // Return the out array
  }, []);
  //Function to check if the customer can edit the inspiration
  const customerCanEditInspo =
    detail && // If the detail is not null
    user && // If the user is not null
    token && // If the token is not null
    !isStaff && // If the user is not a staff member
    !isCanceled(detail) && // If the appointment is not canceled
    !isServiceComplete(detail) && // If the appointment is not complete
    !isPaidAppointment(detail) && // If the appointment is not paid
    !isPastStart(detail) && // If the appointment is not past the start time
    (detail.client_id === user.id || detail.created_by === user.id); // If the client id is the user id or the created by id is the user id, return true

  //Function to apply the inspiration from the picker
  const applyInspoFromPicker = async (paths: string[]) => {
    if (!detail || !token) return; // If the detail is not null and the token is not null, return
    const device = (detail.inspo_pics ?? []).filter((u) => u.startsWith('file:') || u.startsWith('content:')); // Filter the device paths
    const next = [...device, ...paths]; // Push the paths to the next array
    // Try to update the appointment
    try {
      const updated = await updateAppointment(token, detail.id, { inspo_pics: next }); // Update the appointment
      await refreshAppointments(); // Refresh the appointments
      setDetail(updated); // Set the detail state to the updated appointment
      setInspoOpen(false); // Set the inspiration open state to false
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again.'); // Set the alert to the update failed message
    }
  };
  //Function to remove the inspiration at the index
  const removeInspoAt = async (index: number) => {
    if (!detail || !token) return; // If the detail is not null and the token is not null, return
    const pics = detail.inspo_pics ?? []; // Get the inspiration pictures
    if (index < 0 || index >= pics.length) return; // If the index is less than 0 or greater than the length of the pictures, return
    const next = pics.filter((_, i) => i !== index); // Filter the pictures to remove the index
    // Try to update the appointment
    try {
      const updated = await updateAppointment(token, detail.id, { inspo_pics: next.length ? next : null }); // Update the appointment
      await refreshAppointments(); // Refresh the appointments
      setDetail(updated); // Set the detail state to the updated appointment
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again.'); // Set the alert to the update failed message
    }
  };

  //Function to open the staff complete flow
  const openStaffCompleteFlow = () => {
    if (!detail || !token) return; // If the detail is not null and the token is not null, return
    const apptId = detail.id; // Get the appointment id
    // Async function to mark the appointment complete
    const doMarkComplete = async () => {
      // Try to update the appointment
      try {
        const u = await updateAppointment(token, apptId, { status: 'Complete' }); // Update the appointment
        await refreshAppointments(); // Refresh the appointments
        setDetail(u); // Set the detail state to the updated appointment
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Try again.'); // Set the alert to the error message
      }
    };
    // Function to take one and maybe more after photos
    const takeOneOrMore = async () => {
      const cam = await ImagePicker.requestCameraPermissionsAsync(); // Request camera permissions
      // If the camera permissions are not granted, return
      if (!cam.granted) {
        //Set the alert to the permission needed message
        Alert.alert('Permission needed', 'Allow camera access to take after photos.', [
          { text: 'Complete without photos', onPress: () => void doMarkComplete() }, // Set the alert to the complete without photos message
          { text: 'OK', style: 'cancel' }, // Set the alert to the OK message
        ]);
        return; // Return
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.72 }); // Launch the camera
      // If the camera is canceled or the assets are not found, return
      if (res.canceled || !res.assets?.[0]?.uri) {
        //Set the alert to the no photo taken message
        Alert.alert('No photo taken', 'Complete the service anyway?', [
          { text: 'Not yet', style: 'cancel' }, // Set the alert to the not yet message
          { text: 'Complete anyway', onPress: () => void doMarkComplete() }, // Set the alert to the complete anyway message
        ]);
        return; // Return
      }
      const asset = res.assets[0]; // Get the asset
      const { fileName, mimeType } = afterPhotoFilePart(asset.mimeType); // Get the file name and mime type
      // Try to upload the after photo
      try {
        const { appointment } = await uploadAppointmentFinishedPhoto(token, apptId, asset.uri, fileName, mimeType);
        await refreshAppointments(); // Refresh the appointments
        setDetail(appointment); // Set the detail state to the updated appointment
      } catch (e) {
        Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.'); // Set the alert to the upload failed message
        return; // Return
      }
      // Set the alert to the after photo saved message
      Alert.alert('After photo saved', 'Add another or complete the service?', [
        { text: 'Add another', onPress: () => void takeOneOrMore() }, // Set the alert to the add another message
        { text: 'Complete service', onPress: () => void doMarkComplete() }, // Set the alert to the complete service message
      ]);
    };
    // Set the alert to the complete service message
    Alert.alert('Complete service', 'Take after photos with the camera, or skip.', [
      { text: 'Skip', style: 'cancel', onPress: () => void doMarkComplete() }, // Set the alert to the skip message
      { text: 'Take photo', onPress: () => void takeOneOrMore() }, // Set the alert to the take photo message
    ]);
  };
  // Return the appointments tab screen
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Appointments</Text>
      <Pressable style={styles.bookCta} onPress={() => router.push('/book-appointment')}>
        <Text style={styles.bookCtaText}>Book now</Text>
      </Pressable>

      {!user ? (
        <Text style={styles.hint}>Sign in to see your appointments here.</Text>
      ) : null}

      {loading && user ? (
        <ActivityIndicator size="small" color={NavbarColors.text} style={{ marginBottom: 8 }} />
      ) : null}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <Text style={styles.muted}>No appointments yet.</Text>
        ) : (
          list.map((a) => {
            const payLabel = a.invoice_payment_status ?? '—';
            const rowService =
              (a.service_type_title && String(a.service_type_title).trim()) ||
              (a.service_type_id ? serviceTypes.find((s) => s.id === a.service_type_id)?.title : null) ||
              'Visit';
            const timeLabel = formatAppointmentTimeLabel(a.time);
            return (
              <View key={a.id} style={styles.rowOuter}>
                <Pressable style={styles.row} onPress={() => setDetail(a)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{formatAppointmentDate(a.date)}</Text>
                    <Text style={styles.rowSub}>
                      {timeLabel}
                      {' · '}
                      {isStaff ? a.client_name : rowService}
                      {' · '}
                      {a.status}
                    </Text>
                    {isStaff ? <Text style={styles.rowMeta}>Payment: {payLabel}</Text> : null}
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
                {user ? (
                  <Pressable style={styles.rowHelp} onPress={() => openSupportForAppointment(a)}>
                    <Text style={styles.rowHelpText}>Help</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={detail != null && !rescheduleOpen} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
            {detail && token ? (
              <>
                <ScrollView
                  style={styles.detailScroll}
                  contentContainerStyle={styles.detailScrollContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator>
                <Text style={styles.detailTitle}>{formatAppointmentDate(detail.date)}</Text>
                <Text style={styles.detailLine}>
                  {formatAppointmentTimeLabel(detail.time)} · Colorado Springs, CO
                </Text>
                <Text style={styles.detailLine}>Service: {serviceTitle}</Text>
                <Text style={styles.detailLine}>Status: {detail.status}</Text>
                {user ? (
                  <Pressable style={styles.action} onPress={() => openSupportForAppointment(detail)}>
                    <Text style={styles.actionText}>Help with this appointment</Text>
                  </Pressable>
                ) : null}
                {isStaff ? (
                  <>
                    <Text style={styles.detailLine}>Client: {detail.client_name}</Text>
                    <Text style={styles.detailLine}>Invoice: {payStatus}</Text>
                    <Text style={styles.detailMeta}>Booked: {formatWorkflowTs(detail.created_at)}</Text>
                    <Text style={styles.detailMeta}>Confirmed: {formatWorkflowTs(detail.confirmed_at)}</Text>
                    <Text style={styles.detailMeta}>Checked in: {formatWorkflowTs(detail.checked_in_at)}</Text>
                    <Text style={styles.detailMeta}>In progress: {formatWorkflowTs(detail.in_progress_at)}</Text>
                    <Text style={styles.detailMeta}>Completed: {formatWorkflowTs(detail.completed_at)}</Text>
                    <Text style={styles.detailMeta}>Paid: {formatWorkflowTs(detail.paid_at)}</Text>
                    {detail.rescheduled_at ? (
                      <Text style={styles.detailMeta}>Rescheduled: {formatWorkflowTs(detail.rescheduled_at)}</Text>
                    ) : null}
                    {(detail.inspo_pics?.length ?? 0) > 0 ? (
                      <Pressable style={styles.action} onPress={() => setStaffInspoGalleryOpen(true)}>
                        <Text style={styles.actionText}>View client inspiration photos</Text>
                      </Pressable>
                    ) : null}
                    {(detail.completed_photos?.length ?? 0) > 0 ? (
                      <Pressable style={styles.action} onPress={() => setStaffAfterGalleryOpen(true)}>
                        <Text style={styles.actionText}>View after photos</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}

                {isStaff && detail.status === 'Pending' ? (
                  <Pressable
                    style={styles.action}
                    onPress={async () => {
                      try {
                        const u = await updateAppointment(token, detail.id, { status: 'Confirmed' });
                        await refreshAppointments();
                        setDetail(u);
                      } catch (e) {
                        Alert.alert('Error', e instanceof Error ? e.message : 'Try again.');
                      }
                    }}>
                    <Text style={styles.actionText}>Confirm appointment</Text>
                  </Pressable>
                ) : null}

                {isStaff && detail.status === 'Confirmed' ? (
                  <Pressable
                    style={styles.action}
                    onPress={async () => {
                      try {
                        const u = await updateAppointment(token, detail.id, { status: 'Checked In' });
                        await refreshAppointments();
                        setDetail(u);
                      } catch (e) {
                        Alert.alert('Error', e instanceof Error ? e.message : 'Try again.');
                      }
                    }}>
                    <Text style={styles.actionText}>Check in</Text>
                  </Pressable>
                ) : null}

                {isStaff && detail.status === 'Checked In' ? (
                  <Pressable
                    style={styles.action}
                    onPress={async () => {
                      try {
                        const u = await updateAppointment(token, detail.id, { status: 'In Progress' });
                        await refreshAppointments();
                        setDetail(u);
                      } catch (e) {
                        Alert.alert('Error', e instanceof Error ? e.message : 'Try again.');
                      }
                    }}>
                    <Text style={styles.actionText}>Start service</Text>
                  </Pressable>
                ) : null}

                {isStaff && detail.status === 'In Progress' ? (
                  <Pressable style={styles.action} onPress={openStaffCompleteFlow}>
                    <Text style={styles.actionText}>Mark service complete</Text>
                  </Pressable>
                ) : null}

                {isStaff &&
                !isCanceled(detail) &&
                !isServiceComplete(detail) &&
                !isPaidAppointment(detail) ? (
                  <Pressable style={styles.action} onPress={() => openReschedule(detail)}>
                    <Text style={styles.actionText}>Reschedule</Text>
                  </Pressable>
                ) : null}

                {isStaff &&
                !isCanceled(detail) &&
                isServiceComplete(detail) &&
                !isPaidAppointment(detail) &&
                token ? (
                  <Pressable
                    style={styles.action}
                    onPress={() => {
                      const id = detail.id;
                      setDetail(null);
                      router.push({
                        pathname: '/pos-checkout',
                        params: { appointmentId: String(id) },
                      });
                    }}>
                    <Text style={styles.actionText}>Pay</Text>
                  </Pressable>
                ) : null}

                {!isStaff &&
                !isCanceled(detail) &&
                !isServiceComplete(detail) &&
                !isPaidAppointment(detail) ? (
                  <>
                    <Pressable style={styles.action} onPress={() => openReschedule(detail)}>
                      <Text style={styles.actionText}>Reschedule</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionDanger}
                      onPress={async () => {
                        try {
                          await cancelAppointmentApi(token, detail.id);
                          await refreshAppointments();
                          setDetail(null);
                        } catch (e) {
                          Alert.alert('Cancel failed', e instanceof Error ? e.message : 'Try again.');
                        }
                      }}>
                      <Text style={styles.actionText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : null}

                {isStaff &&
                !isCanceled(detail) &&
                !isServiceComplete(detail) &&
                !isPaidAppointment(detail) ? (
                  <Pressable
                    style={styles.actionDanger}
                    onPress={async () => {
                      try {
                        await cancelAppointmentApi(token, detail.id);
                        await refreshAppointments();
                        setDetail(null);
                      } catch (e) {
                        Alert.alert('Cancel failed', e instanceof Error ? e.message : 'Try again.');
                      }
                    }}>
                    <Text style={styles.actionText}>Cancel appointment</Text>
                  </Pressable>
                ) : null}

                {customerCanEditInspo ? (
                  <>
                    <Pressable style={styles.action} onPress={() => setInspoOpen(true)}>
                      <Text style={styles.actionText}>Portfolio inspiration photos</Text>
                    </Pressable>
                    <Pressable
                      style={styles.action}
                      onPress={async () => {
                        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (!perm.granted) {
                          Alert.alert('Permission needed', 'Allow photo library access.');
                          return;
                        }
                        const res = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsMultipleSelection: true,
                          quality: 0.85,
                        });
                        if (res.canceled || !res.assets?.length) return;
                        const uris = res.assets.map((a) => a.uri).filter(Boolean);
                        const next = [...(detail.inspo_pics ?? []), ...uris];
                        try {
                          const u = await updateAppointment(token, detail.id, { inspo_pics: next });
                          await refreshAppointments();
                          setDetail(u);
                        } catch (e) {
                          Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again.');
                        }
                      }}>
                      <Text style={styles.actionText}>Add photos from phone</Text>
                    </Pressable>
                    {(detail.inspo_pics?.length ?? 0) > 0 ? (
                      <View style={styles.inspoSection}>
                        <Text style={styles.inspoSectionTitle}>Your inspiration photos</Text>
                        {(detail.inspo_pics ?? []).map((uri, index) => {
                          const thumbUri = inspoThumbSourceUri(uri);
                          return (
                            <View key={`${uri}-${index}`} style={styles.inspoRow}>
                              {thumbUri ? (
                                <Image source={{ uri: thumbUri }} style={styles.inspoThumb} resizeMode="cover" />
                              ) : (
                                <View style={[styles.inspoThumb, styles.inspoThumbPlaceholder]}>
                                  <Text style={styles.inspoThumbNum}>{index + 1}</Text>
                                </View>
                              )}
                              <Text style={styles.inspoLabel} numberOfLines={1}>
                                Photo {index + 1}
                              </Text>
                              <Pressable
                                style={styles.inspoRemove}
                                onPress={() => {
                                  Alert.alert('Remove photo?', 'This will remove it from your appointment.', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Remove', style: 'destructive', onPress: () => removeInspoAt(index) },
                                  ]);
                                }}>
                                <Text style={styles.inspoRemoveText}>Remove</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                ) : !isStaff &&
                  user &&
                  detail &&
                  !isCanceled(detail) &&
                  customerInspoLockMessage(detail) ? (
                  <Text style={styles.manageHint}>{customerInspoLockMessage(detail)}</Text>
                ) : null}

                </ScrollView>

                <Pressable style={styles.closeBtn} onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </>
            ) : detail ? (
              <>
                <Text style={styles.manageHint}>Sign in again to reschedule or update this appointment.</Text>
                <Pressable style={styles.closeBtn} onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={rescheduleOpen} transparent animationType="slide" onRequestClose={() => setRescheduleOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.resSheet}>
            <Text style={styles.detailTitle}>Reschedule</Text>
            <Text style={styles.label}>Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {nextDates.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => {
                    setResDate(d);
                    setResTime(null);
                  }}
                  style={[styles.chip, resDate === d && styles.chipOn]}>
                  <Text style={[styles.chipText, resDate === d && styles.chipTextOn]}>{d}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Time</Text>
            {resSlotsLoading ? (
              <ActivityIndicator color={NavbarColors.text} style={{ marginVertical: 12 }} />
            ) : (
              <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={styles.chipRow}>
                {resSlots.map((t) => (
                  <Pressable key={t} onPress={() => setResTime(t)} style={[styles.chip, resTime === t && styles.chipOn]}>
                    <Text style={[styles.chipText, resTime === t && styles.chipTextOn]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={styles.resFooter}>
              <Pressable style={styles.secondaryFooter} onPress={() => setRescheduleOpen(false)}>
                <Text style={styles.secondaryFooterText}>Back</Text>
              </Pressable>
              <Pressable style={styles.primaryFooter} onPress={() => applyReschedule()}>
                <Text style={styles.primaryFooterText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {detail && customerCanEditInspo ? (
        <PortfolioPickerModal
          visible={inspoOpen}
          onClose={() => setInspoOpen(false)}
          initialSelected={(detail.inspo_pics ?? []).filter((u) => !u.startsWith('file:') && !u.startsWith('content:'))}
          onConfirm={applyInspoFromPicker}
        />
      ) : null}

      {isStaff && detail ? (
        <>
          <AppointmentPhotoGalleryModal
            visible={staffInspoGalleryOpen}
            onClose={() => setStaffInspoGalleryOpen(false)}
            title="Client inspiration"
            paths={detail.inspo_pics ?? []}
          />
          <AppointmentPhotoGalleryModal
            visible={staffAfterGalleryOpen}
            onClose={() => setStaffAfterGalleryOpen(false)}
            title="After photos"
            paths={detail.completed_photos ?? []}
          />
        </>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 12,
  },
  bookCta: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(194,24,91,0.85)',
    marginBottom: 12,
  },
  bookCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    color: NavbarColors.textMuted,
    marginBottom: 8,
    fontSize: 14,
  },
  list: {
    paddingBottom: 24,
    gap: 8,
  },
  muted: {
    color: NavbarColors.textMuted,
    fontSize: 15,
  },
  rowOuter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 8,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  rowHelp: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'stretch',
  },
  rowHelpText: {
    color: NavbarColors.text,
    fontWeight: '700',
    fontSize: 13,
    alignSelf: 'center',
  },
  rowTitle: {
    color: NavbarColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowSub: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  rowMeta: {
    color: NavbarColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  chev: {
    color: NavbarColors.textMuted,
    fontSize: 22,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  detailCard: {
    backgroundColor: 'rgba(22,12,18,0.98)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    maxHeight: '90%',
  },
  detailScroll: {
    maxHeight: DETAIL_MODAL_MAX_SCROLL,
  },
  detailScrollContent: {
    paddingBottom: 8,
  },
  manageHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: NavbarColors.textMuted,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  detailLine: {
    fontSize: 14,
    color: NavbarColors.textMuted,
    marginBottom: 4,
  },
  detailMeta: {
    fontSize: 12,
    color: NavbarColors.textMuted,
    marginBottom: 2,
    opacity: 0.9,
  },
  action: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(233,30,99,0.35)',
    alignItems: 'center',
  },
  actionDanger: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,120,120,0.5)',
    alignItems: 'center',
  },
  actionText: {
    color: NavbarColors.text,
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  closeBtnText: {
    color: NavbarColors.textMuted,
    textDecorationLine: 'underline',
  },
  inspoSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NavbarColors.border,
  },
  inspoSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: NavbarColors.text,
    marginBottom: 8,
  },
  inspoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inspoThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
  },
  inspoThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspoThumbNum: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  inspoLabel: {
    flex: 1,
    fontSize: 14,
    color: NavbarColors.textMuted,
  },
  inspoRemove: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inspoRemoveText: {
    color: 'rgba(255,150,150,0.95)',
    fontWeight: '700',
    fontSize: 14,
  },
  resSheet: {
    backgroundColor: 'rgba(22,12,18,0.98)',
    borderRadius: 16,
    padding: 16,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  label: {
    color: NavbarColors.textMuted,
    marginTop: 8,
    marginBottom: 6,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  chipOn: {
    backgroundColor: 'rgba(233,30,99,0.35)',
  },
  chipText: {
    color: NavbarColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextOn: {
    color: NavbarColors.text,
  },
  resFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
  },
});
