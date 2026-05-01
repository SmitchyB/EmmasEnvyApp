//Guest Chat Screen that shows the chat history and the ability to send messages
import * as ImagePicker from 'expo-image-picker'; // Import the ImagePicker module from expo-image-picker
import { useRouter } from 'expo-router'; // Import the useRouter module from expo-router
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
import { clearGuestTicketToken, getGuestTicketToken } from '@/lib/guest-ticket-storage'; // Import the clearGuestTicketToken and getGuestTicketToken modules from @/lib/guest-ticket-storage
import { guestCloseTicket, guestGetThread, guestPostMessage } from '@/lib/tickets-api'; // Import the guestCloseTicket, guestGetThread, and guestPostMessage modules from @/lib/tickets-api
import type { SupportMessage, SupportTicket } from '@/lib/ticket-types'; // Import the SupportMessage and SupportTicket types from @/lib/ticket-types

//Function to get the attachment URI
function attachmentUri(attUrl: string): string | null {
  const path = attUrl.startsWith('/uploads/') ? attUrl.slice('/uploads/'.length) : attUrl.replace(/^\//, ''); // Get the path from the attachment URL
  return uploadsUrl(path); // Return the attachment URI
}

//Define the GuestChatScreen component
export default function GuestChatScreen() {
  //All the state variables are defined here
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation
  const [token, setToken] = useState<string | null>(null); // Initialize the token state
  const [ticket, setTicket] = useState<SupportTicket | null>(null); // Initialize the ticket state
  const [messages, setMessages] = useState<SupportMessage[]>([]); // Initialize the messages state
  const [body, setBody] = useState(''); // Initialize the body state
  const [loading, setLoading] = useState(true); // Initialize the loading state
  const [sending, setSending] = useState(false); // Initialize the sending state
  const [pendingUris, setPendingUris] = useState<string[]>([]); // Initialize the pending URIs state
  const [error, setError] = useState<string | null>(null); // Initialize the error state
  const [closing, setClosing] = useState(false); // Initialize the closing state
  
  //Define the load function to load the thread
  const load = useCallback(async (t: string) => {
    setError(null); // Set the error state to null
    // Try to get the thread
    try {
      const data = await guestGetThread(t); // Get the thread
      setTicket(data.ticket); // Set the ticket state
      setMessages(data.messages); // Set the messages state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load'); // Set the error state to the error message
      await clearGuestTicketToken(); // Clear the guest ticket token
    } finally {
      setLoading(false); // Set the loading state to false
    }
  }, []);

  //Define the useEffect hook to load the thread
  useEffect(() => {
    // Try to get the guest ticket token
    (async () => {
      const t = await getGuestTicketToken(); // Get the guest ticket token
      setToken(t); // Set the token state
      // If the token is not found, set the loading state to false and return 
      if (!t) {
        setLoading(false); // Set the loading state to false
        return; // Return
      }
      await load(t); // Load the thread
    })();
  }, [load]);

  //Define the pickImage function to pick an image from the media library
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

  //Define the send function to send a message to the ticket
  const send = async () => {
    if (!token || (!body.trim() && pendingUris.length === 0)) return; // If the token or body is not found, return
    setSending(true); // Set the sending state to true
    setError(null); // Set the error state to null
    // Try to send the message
    try {
      // Send the message
      const { ticket: t, messages: next } = await guestPostMessage(
        token,
        body.trim() || ' ',
        pendingUris.length ? pendingUris : undefined
      );
      setTicket(t); // Set the ticket state
      setMessages(next); // Set the messages state
      setBody(''); // Set the body state to empty
      setPendingUris([]); // Set the pending URIs state to empty
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed'); // Set the error state to the error message
    } finally {
      setSending(false); // Set the sending state to false
    }
  };

  //Define the closeTicket function to close the ticket
  const closeTicket = async () => {
    if (!token) return; // If the token is not found, return
    setClosing(true); // Set the closing state to true
    setError(null); // Set the error state to null
    // Try to close the ticket
    try {
      const { ticket: t, messages: next } = await guestCloseTicket(token); // Close the ticket
      setTicket(t); // Set the ticket state
      setMessages(next); // Set the messages state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close'); // Set the error state to the error message
    } finally {
      setClosing(false); // Set the closing state to false
    }
  };

  //If the loading state is true, return a loading indicator
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={NavbarColors.text} />
      </View>
    );
  }

  //If the token or error is not found, return a view with a title, a muted text, and a button to enter the ticket number
  if (!token || error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <Text style={styles.title}>Could not open chat</Text>
        <Text style={styles.muted}>{error || 'Sign in with your ticket number again.'}</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/support/guest-claim')}>
          <Text style={styles.btnText}>Enter ticket number</Text>
        </Pressable>
      </View>
    );
  }

  //Return a view with a title, a muted text, a button to enter the ticket number, and a button to close the ticket
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.ref}>{ticket?.public_reference}</Text>
        <Text style={styles.status}>{ticket?.status.replace(/_/g, ' ')}</Text>
        {ticket && ticket.status !== 'closed' ? (
          <Pressable
            style={[styles.closeTicketBtn, closing && styles.btnDisabled]}
            onPress={() => void closeTicket()}
            disabled={closing}>
            <Text style={styles.closeTicketBtnText}>{closing ? 'Closing…' : 'Close ticket'}</Text>
          </Pressable>
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
          return (
          <View
            key={m.id}
            style={[
              styles.bubbleWrap,
              m.author_kind === 'guest' ? styles.bubbleGuest : styles.bubbleOther,
            ]}>
            <Text style={styles.bubbleMeta}>{m.author_kind}</Text>
            <Text style={styles.bubbleText}>{m.body}</Text>
            {(m.attachments || []).map((att) => {
              const u = attachmentUri(att.url);
              return u ? <Image key={att.id} source={{ uri: u }} style={styles.att} /> : null;
            })}
          </View>
          );
        })}
      </ScrollView>
      {pendingUris.length > 0 ? (
        <Text style={styles.pending}>{pendingUris.length} image(s) attached</Text>
      ) : null}
      <View style={styles.composer}>
        <Pressable style={styles.attachBtn} onPress={() => void pickImage()}>
          <Text style={styles.attachBtnText}>Photo</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message"
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
  status: { color: NavbarColors.textMuted, fontSize: 14 },
  closeTicketBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  closeTicketBtnText: { color: NavbarColors.text, fontWeight: '600', fontSize: 14 },
  bubbleSystem: {
    alignSelf: 'center',
    maxWidth: '96%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  thread: { flex: 1 },
  threadContent: { paddingBottom: 12 },
  bubbleWrap: { maxWidth: '88%', padding: 10, borderRadius: 12, marginBottom: 8 },
  bubbleGuest: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.2)' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.25)' },
  bubbleMeta: { fontSize: 11, color: NavbarColors.textMuted, marginBottom: 4 },
  bubbleText: { color: NavbarColors.text, fontSize: 15 },
  att: { width: 160, height: 120, borderRadius: 8, marginTop: 8 },
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
  title: { color: NavbarColors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  muted: { color: NavbarColors.textMuted, textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  btnText: { color: NavbarColors.text, fontWeight: '600' },
  pending: { color: NavbarColors.textMuted, fontSize: 12, marginBottom: 4 },
});
