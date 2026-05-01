//Guest New Ticket Screen that allows a guest user to create a new ticket
import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from expo-image-picker
import { useRouter } from 'expo-router'; // Import the useRouter module from expo-router
import React, { useEffect, useState } from 'react'; // Import the React, useEffect, and useState modules from react
import {
  ActivityIndicator, // Import the ActivityIndicator module from react-native
  Pressable, // Import the Pressable module from react-native
  ScrollView, // Import the ScrollView module from react-native
  StyleSheet, // Import the StyleSheet module from react-native
  Text, // Import the Text module from react-native
  TextInput, // Import the TextInput module from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from react-native-safe-area-context
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors modules from @/constants/theme
import {
  fetchIssueTypes, // Import the fetchIssueTypes module from @/lib/tickets-api
  guestCreateTicket, // Import the guestCreateTicket module from @/lib/tickets-api
  guestFindRecords, // Import the guestFindRecords module from @/lib/tickets-api
  guestVerifyAppointment, // Import the guestVerifyAppointment module from @/lib/tickets-api
} from '@/lib/tickets-api';
import type { GuestInvoiceOption, IssueTypeOption } from '@/lib/ticket-types'; // Import the GuestInvoiceOption and IssueTypeOption modules from @/lib/ticket-types

//Define the GuestNewTicketScreen component
export default function GuestNewTicketScreen() {
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation
  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]); // Initialize the issue types state
  const [issueType, setIssueType] = useState<string | null>(null); // Initialize the issue type state
  const [guestEmail, setGuestEmail] = useState(''); // Initialize the guest email state
  const [guestPhone, setGuestPhone] = useState(''); // Initialize the guest phone state
  const [subject, setSubject] = useState(''); // Initialize the subject state
  const [body, setBody] = useState(''); // Initialize the body state
  const [lookupEmail, setLookupEmail] = useState(''); // Initialize the lookup email state
  const [lookupPhone, setLookupPhone] = useState(''); // Initialize the lookup phone state
  const [lookupApptId, setLookupApptId] = useState(''); // Initialize the lookup appointment id state
  const [invoiceOptions, setInvoiceOptions] = useState<GuestInvoiceOption[]>([]); // Initialize the invoice options state
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<number | null>(null); // Initialize the linked appointment id state
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<number | null>(null); // Initialize the linked invoice id state
  const [imageUris, setImageUris] = useState<string[]>([]); // Initialize the image URIs state
  const [loading, setLoading] = useState(false); // Initialize the loading state
  const [error, setError] = useState<string | null>(null); // Initialize the error state

  //useEffect hook to fetch the issue types
  useEffect(() => {
    let c = false; // Set the cancelled flag to false
    // Use the useEffect hook to fetch the issue types
    (async () => {
      try {
        const t = await fetchIssueTypes(); // Fetch the issue types
        if (!c) setIssueTypes(t); // Set the issue types state
      } catch {
        if (!c) setIssueTypes([]); // Set the issue types state to an empty array
      }
    })();
    // Return a function to set the cancelled flag to true
    return () => {
      c = true; // Set the cancelled flag to true
    };
  }, []);

  // function to pick an image from the media library
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); // Request the media library permissions
    if (!perm.granted) return; // If the permissions are not granted, return
    // Launch the image library async
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Media types options for the image picker
      quality: 0.85, // Quality for the image picker
      allowsMultipleSelection: true, // Allows multiple selection for the image picker
      selectionLimit: 4, // Selection limit for the image picker
    });
    if (r.canceled) return; // If the image is canceled, return
    setImageUris((prev) => [...prev, ...r.assets.map((a) => a.uri)]); // Set the image URIs state
  };

  //function to run the invoice lookup
  const runInvoiceLookup = async () => {
    setError(null); // Set the error state to null
    // Try to find the records
    try {
      // Find the records
      const opts = await guestFindRecords({
        email: lookupEmail.trim() || undefined,
        phone: lookupPhone.trim() || undefined,
      });
      setInvoiceOptions(opts); // Set the invoice options state
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Lookup failed'); // Set the error state to the error message
    }
  };

  //function to run the appointment verification
  const runApptVerify = async () => {
    setError(null); // Set the error state to null
    const id = parseInt(lookupApptId, 10); // Parse the appointment id
    // If the appointment id is not a number, set the error state to 'Enter a numeric appointment id' and return
    if (Number.isNaN(id)) {
      setError('Enter a numeric appointment id'); // Set the error state to 'Enter a numeric appointment id'
      return;
    }
    // Try to verify the appointment
    try {
      // Verify the appointment
      const appt = await guestVerifyAppointment({
        appointment_id: id,
        email: guestEmail.trim() || lookupEmail.trim() || undefined,
        phone: guestPhone.trim() || lookupPhone.trim() || undefined,
      });
      setLinkedAppointmentId(appt.id); // Set the linked appointment id state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify appointment'); // Set the error state to the error message
    }
  };

  //function to submit the ticket
  const submit = async () => {
    setError(null); // Set the error state to null
    // If the guest email or guest phone is not found, set the error state to 'Email or phone required' and return
    if (!guestEmail.trim() && !guestPhone.trim()) {
      setError('Email or phone required'); // Set the error state to 'Email or phone required'
      return;
    }
    // If the issue type is not found, set the error state to 'Choose an issue type' and return
    if (!issueType) {
      setError('Choose an issue type'); // Set the error state to 'Choose an issue type'
      return;
    }
    // If the body is not found, set the error state to 'Describe your issue' and return
    if (!body.trim()) {
      setError('Describe your issue'); // Set the error state to 'Describe your issue'
      return;
    }
    setLoading(true); // Set the loading state to true
    // Try to create the ticket
    try {
      // Create the ticket
      const { ticket } = await guestCreateTicket({
        guest_email: guestEmail.trim() || undefined, // Set the guest email
        guest_phone: guestPhone.trim() || undefined, // Set the guest phone
        issue_type: issueType, // Set the issue type
        subject: subject.trim() || undefined, // Set the subject
        body: body.trim(), // Set the body
        linked_appointment_id: linkedAppointmentId, // Set the linked appointment id
        linked_invoice_id: linkedInvoiceId, // Set the linked invoice id
        imageUris: imageUris.length ? imageUris : undefined, // Set the image URIs
      });
      router.replace({ pathname: '/support/guest-claim', params: { ref: ticket.public_reference } }); // Replace the current screen with the guest claim screen
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  };

  //Return a view with a title, a label, a text input for the guest email, a text input for the guest phone, a text input for the lookup email, a text input for the lookup phone, a button to search invoices, a button to verify appointment, a text input for the appointment id, a text input for the issue type, a text input for the subject, a text input for the body, a button to add photos, an error text, a button to submit the ticket, and a muted text
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>New support ticket</Text>
      <Text style={styles.label}>Your contact</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={NavbarColors.textMuted}
        value={guestEmail}
        onChangeText={setGuestEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Phone"
        placeholderTextColor={NavbarColors.textMuted}
        value={guestPhone}
        onChangeText={setGuestPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.section}>Link billing (optional)</Text>
      <Text style={styles.muted}>Find invoices by the email or phone on file.</Text>
      <TextInput
        style={styles.input}
        placeholder="Lookup email"
        placeholderTextColor={NavbarColors.textMuted}
        value={lookupEmail}
        onChangeText={setLookupEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Lookup phone"
        placeholderTextColor={NavbarColors.textMuted}
        value={lookupPhone}
        onChangeText={setLookupPhone}
        keyboardType="phone-pad"
      />
      <Pressable style={styles.btnSecondary} onPress={() => void runInvoiceLookup()}>
        <Text style={styles.btnSecondaryText}>Search invoices</Text>
      </Pressable>
      {invoiceOptions.map((o) => (
        <Pressable
          key={o.invoice_db_id}
          style={styles.option}
          onPress={() => {
            setLinkedInvoiceId(o.invoice_db_id);
            if (o.appointment_id) setLinkedAppointmentId(o.appointment_id);
          }}>
          <Text style={styles.optionText}>
            Invoice {o.invoice_label} · {o.payment_status} · tap to link
          </Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Link appointment id (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Appointment id"
        placeholderTextColor={NavbarColors.textMuted}
        value={lookupApptId}
        onChangeText={setLookupApptId}
        keyboardType="number-pad"
      />
      <Pressable style={styles.btnSecondary} onPress={() => void runApptVerify()}>
        <Text style={styles.btnSecondaryText}>Verify appointment</Text>
      </Pressable>
      {linkedAppointmentId != null ? (
        <Text style={styles.linked}>Linked appointment #{linkedAppointmentId}</Text>
      ) : null}
      {linkedInvoiceId != null ? <Text style={styles.linked}>Linked invoice db #{linkedInvoiceId}</Text> : null}

      <Text style={styles.section}>Issue type</Text>
      {issueTypes.map((it) => (
        <Pressable
          key={it.id}
          style={[styles.chip, issueType === it.id && styles.chipOn]}
          onPress={() => setIssueType(it.id)}>
          <Text style={[styles.chipText, issueType === it.id && styles.chipTextOn]}>{it.label}</Text>
          <Text style={styles.chipMeta}>{it.handler_team.toUpperCase()}</Text>
        </Pressable>
      ))}

      <TextInput
        style={styles.input}
        placeholder="Subject (optional)"
        placeholderTextColor={NavbarColors.textMuted}
        value={subject}
        onChangeText={setSubject}
      />
      <TextInput
        style={[styles.input, styles.body]}
        placeholder="How can we help?"
        placeholderTextColor={NavbarColors.textMuted}
        value={body}
        onChangeText={setBody}
        multiline
      />
      <Pressable style={styles.btnSecondary} onPress={() => void pickImage()}>
        <Text style={styles.btnSecondaryText}>Add photos ({imageUris.length})</Text>
      </Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={() => void submit()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit ticket</Text>}
      </Pressable>
      <Text style={styles.muted}>
        After submitting, open your ticket with the number we text you (and the next screen).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 24 },
  title: { color: NavbarColors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: NavbarColors.textMuted, marginBottom: 6 },
  section: { color: NavbarColors.text, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  muted: { color: NavbarColors.textMuted, fontSize: 13, marginBottom: 8 },
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
  body: { minHeight: 100, textAlignVertical: 'top' },
  chip: {
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  chipOn: { borderColor: GradientColors.pink, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipText: { color: NavbarColors.text, fontSize: 14 },
  chipTextOn: { fontWeight: '600' },
  chipMeta: { color: NavbarColors.textMuted, fontSize: 11, marginTop: 4 },
  btn: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: NavbarColors.text, fontSize: 17, fontWeight: '600' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: NavbarColors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSecondaryText: { color: NavbarColors.text },
  option: { padding: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, marginBottom: 6 },
  optionText: { color: NavbarColors.text, fontSize: 14 },
  linked: { color: GradientColors.pinkLight, marginBottom: 8 },
  err: { color: '#ff6b6b', marginTop: 8 },
});
