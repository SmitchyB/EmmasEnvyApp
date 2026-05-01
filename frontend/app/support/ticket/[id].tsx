//Ticket Detail Screen that shows the ticket details, messages, and the ability to send messages and mark the ticket as resolved or closed

import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from expo-image-picker
import { useLocalSearchParams, useRouter } from 'expo-router'; // Import the useLocalSearchParams and useRouter modules from expo-router
import React, { useCallback, useEffect, useState } from 'react'; // Import the React, useCallback, useEffect, and useState modules from react
import {
  ActivityIndicator, // Import the ActivityIndicator module from react-native
  Image, // Import the Image module from react-native
  Pressable, // Import the Pressable module from react-native
  ScrollView, // Import the ScrollView module from react-native 
  StyleSheet, // Import the StyleSheet module from react-native
  Text, // Import the Text module from react-native
  TextInput, // Import the TextInput module from react-native
  View, // Import the View module from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from react-native-safe-area-context
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl module from @/constants/config
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors modules from @/constants/theme
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from @/contexts/AuthContext
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole module from @/lib/roles
import { closeTicketAsCustomer, getTicket, patchTicketStaff, postTicketMessage } from '@/lib/tickets-api'; // Import the closeTicketAsCustomer, getTicket, patchTicketStaff, and postTicketMessage modules from @/lib/tickets-api
import type { SupportMessage, SupportTicket } from '@/lib/ticket-types'; // Import the SupportMessage and SupportTicket types from @/lib/ticket-types

// Define the attachmentUri function to get the attachment URI
function attachmentUri(attUrl: string): string | null {
  const path = attUrl.startsWith('/uploads/') ? attUrl.slice('/uploads/'.length) : attUrl.replace(/^\//, ''); // Get the path from the attachment URL
  return uploadsUrl(path); // Return the attachment URI
}

// Define the SupportTicketDetailScreen component
export default function SupportTicketDetailScreen() {
  //All the state variables are defined here
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation
  const { id: idParam } = useLocalSearchParams<{ id: string }>(); // Get the id from the local search params
  const id = parseInt(String(idParam), 10); // Parse the id from the local search params
  const { user, token } = useAuth(); // Get the user and token from the useAuth module
  const [ticket, setTicket] = useState<SupportTicket | null>(null); // Initialize the ticket state
  const [messages, setMessages] = useState<SupportMessage[]>([]); // Initialize the messages state
  const [body, setBody] = useState(''); // Initialize the body state
  const [internalNote, setInternalNote] = useState(false); // Initialize the internal note state
  const [loading, setLoading] = useState(true); // Initialize the loading state
  const [sending, setSending] = useState(false); // Initialize the sending state
  const [pendingUris, setPendingUris] = useState<string[]>([]); // Initialize the pending URIs state
  const [error, setError] = useState<string | null>(null); // Initialize the error state
  const [actionBusy, setActionBusy] = useState(false); // Initialize the action busy state

  const staff = user ? isStaffRole(user.role) : false; // Check if the user is a staff member
  // Check if the user is the requester of the ticket
  const iAmRequester =
    Boolean(ticket && user && ticket.user_id != null && ticket.user_id === user.id);
  const canUseInternal = staff && !iAmRequester; // Check if the user can use internal notes
  const canMarkResolved = Boolean(staff && !iAmRequester && ticket && ticket.status !== 'resolved' && ticket.status !== 'closed'); // Check if the user can mark the ticket as resolved
  // Check if the user can close the ticket as a customer
  const canCloseAsCustomer = Boolean(
    ticket && user && ticket.user_id != null && ticket.user_id === user.id && ticket.status !== 'closed'
  );

  // Use the useEffect hook to replace the page if the id is not a number
  useEffect(() => {
    // If the id is not a number, replace the page with the support page
    if (Number.isNaN(id)) {
      router.replace('/support'); // Replace the page with the support page
    }
  }, [id, router]);

  // Use the useCallback hook to load the ticket
  const load = useCallback(async () => {
    if (!token || Number.isNaN(id)) return; // If the token or id is not found, return
    setError(null); // Set the error state to null
    // Try to get the ticket
    try {
      const data = await getTicket(token, id); // Get the ticket
      setTicket(data.ticket); // Set the ticket state
      setMessages(data.messages); // Set the messages state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  }, [token, id]); // Dependencies for the load function

  // Use the useEffect hook to load the ticket
  useEffect(() => {
    void load(); // Load the ticket
  }, [load]);

  // Use the useEffect hook to set the internal note to false if the user cannot use internal notes
  useEffect(() => {
    // If the user cannot use internal notes and the internal note is true, set the internal note to false
    if (!canUseInternal && internalNote) {
      setInternalNote(false); // Set the internal note to false
    }
  }, [canUseInternal, internalNote]);

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
    setPendingUris((prev) => [...prev, ...r.assets.map((a) => a.uri)]); // Set the pending URIs state
  };

  // Define the send function to send a message to the ticket
  const send = async () => {
    if (!token || (!body.trim() && pendingUris.length === 0)) return; // If the token or body is not found, return
    setSending(true); // Set the sending state to true
    setError(null); // Set the error state to null
    // Try to send the message
    try {
      // Send the message
      const next = await postTicketMessage(token, id, body.trim() || ' ', {
        is_internal: canUseInternal && internalNote,
        imageUris: pendingUris.length ? pendingUris : undefined,
      });
      setMessages(next); // Set the messages state
      setBody(''); // Set the body state to empty
      setPendingUris([]); // Set the pending URIs state to empty
      setInternalNote(false); // Set the internal note state to false
      void load(); // Load the ticket
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed'); // Set the error state to the error message
    } finally {
      setSending(false); // Set the sending state to false
    }
  };

  // Define the markResolved function to mark the ticket as resolved
  const markResolved = async () => {
    if (!token || !canMarkResolved) return; // If the token or canMarkResolved is not found, return
    setActionBusy(true); // Set the action busy state to true
    setError(null); // Set the error state to null
    // Try to mark the ticket as resolved
    try {
      const t = await patchTicketStaff(token, id, { status: 'resolved' }); // Mark the ticket as resolved
      setTicket(t); // Set the ticket state
      await load(); // Load the ticket
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update'); // Set the error state to the error message
    } finally {
      setActionBusy(false); // Set the action busy state to false
    }
  };

  // Define the closeAsCustomer function to close the ticket as a customer
  const closeAsCustomer = async () => {
    if (!token || !canCloseAsCustomer) return; // If the token or canCloseAsCustomer is not found, return
    setActionBusy(true); // Set the action busy state to true
    setError(null); // Set the error state to null
    // Try to close the ticket as a customer
    try {
      const t = await closeTicketAsCustomer(token, id); // Close the ticket as a customer
      setTicket(t); // Set the ticket state
      await load(); // Load the ticket
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close'); // Set the error state to the error message
    } finally {
      setActionBusy(false); // Set the action busy state to false
    }
  };

  // If the id is not a number, return a loading indicator
  if (Number.isNaN(id)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={NavbarColors.text} />
      </View>
    );
  }

  // If the token is not found, return a view with a title, a muted text, a button to go back to the support page
  if (!token) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <Text style={styles.muted}>Sign in to view this ticket.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/support')}>
          <Text style={styles.btnText}>Support home</Text>
        </Pressable>
      </View>
    );
  }

  // If the loading state is true, return a loading indicator
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={NavbarColors.text} />
      </View>
    );
  }

  // If the error is not null and the ticket is not found, return a view with a title, a muted text, and a button to go back
  if (error && !ticket) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <Text style={styles.err}>{error}</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  // Return a view with a header, a thread, a composer, and a button to go back
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.ref}>{ticket?.public_reference}</Text>
        <Text style={styles.meta}>
          {ticket?.status.replace(/_/g, ' ')} · {(ticket?.handler_team ?? '').toUpperCase()}
        </Text>
        {canMarkResolved || canCloseAsCustomer ? (
          <View style={styles.actionRow}>
            {canMarkResolved ? (
              <Pressable
                style={[styles.actionBtn, actionBusy && styles.btnDisabled]}
                onPress={() => void markResolved()}
                disabled={actionBusy}>
                <Text style={styles.actionBtnText}>{actionBusy ? '…' : 'Mark resolved'}</Text>
              </Pressable>
            ) : null}
            {canCloseAsCustomer ? (
              <Pressable
                style={[styles.actionBtnSecondary, actionBusy && styles.btnDisabled]}
                onPress={() => void closeAsCustomer()}
                disabled={actionBusy}>
                <Text style={styles.actionBtnSecondaryText}>{actionBusy ? '…' : 'Close ticket'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.map((m) => {
          if (m.author_kind === 'system') {
            return (
              <View key={m.id} style={[styles.bubbleWrap, styles.bubbleSystem]}>
                <Text style={styles.bubbleMeta}>Automated</Text>
                <Text style={styles.bubbleText}>{m.body}</Text>
              </View>
            );
          }
          let alignRight: boolean;
          if (iAmRequester) {
            alignRight = m.author_kind === 'user' && Boolean(user && m.author_user_id === user.id);
          } else if (staff) {
            alignRight = m.author_kind === 'staff' && Boolean(user && m.author_user_id === user.id);
          } else {
            alignRight = m.author_kind === 'user' && Boolean(user && m.author_user_id === user.id);
          }
          return (
            <View
              key={m.id}
              style={[
                styles.bubbleWrap,
                alignRight ? styles.bubbleUser : styles.bubbleStaff,
              ]}>
              <Text style={styles.bubbleMeta}>
                {m.author_kind}
                {m.is_internal ? ' · internal' : ''}
              </Text>
              <Text style={styles.bubbleText}>{m.body}</Text>
              {(m.attachments || []).map((att) => {
                const u = attachmentUri(att.url);
                return u ? <Image key={att.id} source={{ uri: u }} style={styles.att} /> : null;
              })}
            </View>
          );
        })}
      </ScrollView>
      {canUseInternal ? (
        <Pressable style={styles.internalToggle} onPress={() => setInternalNote((v) => !v)}>
          <Text style={styles.internalToggleText}>{internalNote ? 'Internal note (on)' : 'Internal note (off)'}</Text>
        </Pressable>
      ) : null}
      {pendingUris.length > 0 ? (
        <Text style={styles.pending}>{pendingUris.length} image(s)</Text>
      ) : null}
      <View style={styles.composer}>
        <Pressable style={styles.attachBtn} onPress={() => void pickImage()}>
          <Text style={styles.attachBtnText}>Photo</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={canUseInternal && internalNote ? 'Internal note' : 'Message'}
          placeholderTextColor={NavbarColors.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Pressable style={[styles.sendBtn, sending && styles.btnDisabled]} onPress={() => void send()} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 8 },
  back: { color: GradientColors.pinkLight, fontSize: 16, marginBottom: 4 },
  ref: { color: NavbarColors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: NavbarColors.textMuted, fontSize: 14 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionBtn: {
    backgroundColor: GradientColors.pinkDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: { color: NavbarColors.text, fontWeight: '600', fontSize: 14 },
  actionBtnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  actionBtnSecondaryText: { color: NavbarColors.text, fontWeight: '600', fontSize: 14 },
  bubbleSystem: {
    alignSelf: 'center',
    maxWidth: '96%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  thread: { flex: 1 },
  threadContent: { paddingBottom: 12 },
  bubbleWrap: { maxWidth: '90%', padding: 10, borderRadius: 12, marginBottom: 8 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.2)' },
  bubbleStaff: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.25)' },
  bubbleMeta: { fontSize: 11, color: NavbarColors.textMuted, marginBottom: 4 },
  bubbleText: { color: NavbarColors.text, fontSize: 15 },
  att: { width: 160, height: 120, borderRadius: 8, marginTop: 8 },
  internalToggle: { marginBottom: 4 },
  internalToggleText: { color: GradientColors.pinkLight, fontSize: 13 },
  pending: { color: NavbarColors.textMuted, fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: NavbarColors.text,
  },
  sendBtn: {
    backgroundColor: GradientColors.pinkDark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  sendBtnText: { color: NavbarColors.text, fontWeight: '600' },
  attachBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  attachBtnText: { color: GradientColors.pinkLight, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  btn: {
    marginTop: 16,
    backgroundColor: GradientColors.pinkDark,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: NavbarColors.text, fontWeight: '600' },
  muted: { color: NavbarColors.textMuted, textAlign: 'center' },
  err: { color: '#ff6b6b', textAlign: 'center' },
});
