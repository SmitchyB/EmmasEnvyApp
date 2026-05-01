//Create a new ticket screen that allows the user to create a new ticket
import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from expo-image-picker
import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter modules from expo-router
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
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from @/contexts/AuthContext
import { createTicket, fetchIssueTypes } from '@/lib/tickets-api'; // Import the createTicket and fetchIssueTypes modules from @/lib/tickets-api
import type { IssueTypeOption } from '@/lib/ticket-types'; // Import the IssueTypeOption type from @/lib/ticket-types

// Define the SupportCreateScreen component
export default function SupportCreateScreen() {
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation  
  const { token } = useAuth(); // Get the token from the useAuth module
  // Get the linked appointment id and prefill issue type from the local search params
  const params = useLocalSearchParams<{
    linkedAppointmentId?: string; // Get the linked appointment id from the local search params
    prefillIssueType?: string; // Get the prefill issue type from the local search params
  }>();
  // Parse the linked appointment id and prefill issue type from the local search params
  const linkedAppointmentId =
    params.linkedAppointmentId != null ? parseInt(String(params.linkedAppointmentId), 10) : null;
  const prefillIssue = params.prefillIssueType ? String(params.prefillIssueType) : null; // Parse the prefill issue type from the local search params

  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]); // Initialize the issue types state
  const [issueType, setIssueType] = useState<string | null>(prefillIssue); // Initialize the issue type state
  const [subject, setSubject] = useState(''); // Initialize the subject state
  const [body, setBody] = useState(''); // Initialize the body state
  const [imageUris, setImageUris] = useState<string[]>([]); // Initialize the image URIs state
  const [loading, setLoading] = useState(false); // Initialize the loading state
  const [error, setError] = useState<string | null>(null); // Initialize the error state

  // Use the useEffect hook to fetch the issue types
  useEffect(() => {
    let c = false; // Set the cancelled flag to false
    // Use the useEffect hook to fetch the issue types
    (async () => {
      // Try to fetch the issue types
      try {
        const t = await fetchIssueTypes(); // Fetch the issue types
        // If the cancelled flag is false, set the issue types and prefill the issue type if it is set
        if (!c) {
          setIssueTypes(t); // Set the issue types state
          // If the prefill issue type is set and the issue type is in the issue types array, set the issue type
          if (prefillIssue && t.some((x) => x.id === prefillIssue)) {
            setIssueType(prefillIssue); // Set the issue type state
          }
        }
      } catch {
        if (!c) setIssueTypes([]); // If the cancelled flag is false, set the issue types state to an empty array
      }
    })();
    // Return a function to set the cancelled flag to true
    return () => {
      c = true;
    };
  }, [prefillIssue]);

  // Define the pickImage function to pick an image from the media library
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

  // Define the submit function to submit the ticket
  const submit = async () => {
    if (!token) return; // If the token is not found, return
    setError(null); // Set the error state to null
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
      const ticket = await createTicket(token, {
        issue_type: issueType, // Set the issue type
        subject: subject.trim() || undefined, // Set the subject
        body: body.trim(), // Set the body
        linked_appointment_id: linkedAppointmentId != null && !Number.isNaN(linkedAppointmentId) ? linkedAppointmentId : null, // Set the linked appointment id
        imageUris: imageUris.length ? imageUris : undefined, // Set the image URIs
      });
      router.replace({ pathname: '/support/ticket/[id]', params: { id: String(ticket.id) } }); // Replace the current screen with the ticket detail screen
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  };

  // Return a view with a title, a linked appointment text, a list of issue types, a subject input, a body input, a button to add photos, an error text, a submit button, and a cancel button
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>New ticket</Text>
      {linkedAppointmentId != null && !Number.isNaN(linkedAppointmentId) ? (
        <Text style={styles.linked}>Appointment #{linkedAppointmentId} will be linked.</Text>
      ) : null}
      {issueTypes.map((it) => (
        <Pressable
          key={it.id}
          style={[styles.chip, issueType === it.id && styles.chipOn]}
          onPress={() => setIssueType(it.id)}>
          <Text style={[styles.chipText, issueType === it.id && styles.chipTextOn]}>{it.label}</Text>
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
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
      </Pressable>
      <Pressable style={styles.link} onPress={() => router.back()}>
        <Text style={styles.linkText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 24 },
  title: { color: NavbarColors.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  linked: { color: GradientColors.pinkLight, marginBottom: 12 },
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
  body: { minHeight: 120, textAlignVertical: 'top' },
  btn: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
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
  link: { marginTop: 16, alignSelf: 'center' },
  linkText: { color: GradientColors.pinkLight },
  err: { color: '#ff6b6b', marginTop: 8 },
});
