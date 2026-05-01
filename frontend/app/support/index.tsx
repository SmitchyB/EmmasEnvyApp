//main support hub that splits the view between auth loading spinner, Not Sign In Guest Entry, Signed In User Entry for both Staff and Non-Staff

import { useRouter } from 'expo-router'; // Import the useRouter hook from expo-router for the navigation
import { useFocusEffect } from '@react-navigation/native'; // Import the useFocusEffect hook from @react-navigation/native for the focus effect
import React, { useCallback, useMemo, useState } from 'react'; // Import the React, useCallback, useMemo, and useState hooks from react
import {
  ActivityIndicator, // Import the ActivityIndicator component from react-native
  Pressable, // Import the Pressable component from react-native
  ScrollView, // Import the ScrollView component from react-native
  StyleSheet, // Import the StyleSheet component from react-native
  Text, // Import the Text component from react-native
  View, // Import the View component from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets hook from react-native-safe-area-context for the safe area insets
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors modules from @/constants/theme
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook from @/contexts/AuthContext
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole function from @/lib/roles
import { listMyTickets } from '@/lib/tickets-api'; // Import the listMyTickets function from @/lib/tickets-api
import type { SupportTicket, SupportTicketStatus } from '@/lib/ticket-types'; // Import the SupportTicket and SupportTicketStatus types from @/lib/ticket-types

// Define the status filters for the support tickets
const STATUS_FILTERS: { id: 'all' | SupportTicketStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending_customer', label: 'Awaiting you' },
  { id: 'pending_staff', label: 'Awaiting staff' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

// Define the SupportIndexScreen component
export default function SupportIndexScreen() {
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation
  const { user, token, isLoading: authLoading } = useAuth(); // Get the user and token from the useAuth hook
  const [tickets, setTickets] = useState<SupportTicket[]>([]); // Initialize the tickets state
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all'); // Initialize the status filter state
  const [loading, setLoading] = useState(false); // Initialize the loading state
  const [error, setError] = useState<string | null>(null); // Initialize the error state
  // Define the filtered tickets state
  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets; // If the status filter is all, return all tickets
    return tickets.filter((t) => t.status === statusFilter); // If the status filter is not all, return the tickets that match the status filter
  }, [tickets, statusFilter]);

  // Define the load function
  const load = useCallback(async () => {
    if (!user || !token) return; // If the user or token is not found, return
    setLoading(true); // Set the loading state to true
    setError(null); // Set the error state to null
    // Try to load the tickets
    try {
      const list = await listMyTickets(token); // Load the tickets
      setTickets(list); // Set the tickets state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  }, [user, token]); // Dependencies for the load function

  // Use the useFocusEffect hook to load the tickets when the screen is focused
  useFocusEffect(
    //useCallback to load the tickets
    useCallback(() => {
      void load(); // Load the tickets
    }, [load]) 
  );

  // If the auth loading state is true, return a loading indicator
  if (authLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={NavbarColors.text} />
      </View>
    );
  }

  // If the user is not found, return a view with a title, a muted text, a button to claim a ticket, a button to start a new ticket, and a button to go back
  if (!user) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.muted}>Get help without signing in, or open a ticket you already started.</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/support/guest-claim')}>
          <Text style={styles.btnText}>I have a ticket number</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => router.push('/support/guest-new')}>
          <Text style={styles.btnText}>Start a new ticket</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const staff = isStaffRole(user.role); // Check if the user is a staff member

  // Return a view with a title, a button to go to the staff queue, a button to create a new ticket, a filter for the status of the tickets, and a list of the tickets
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>My support tickets</Text>
      {staff ? (
        <Pressable style={styles.btnSecondary} onPress={() => router.push('/support/staff')}>
          <Text style={styles.btnSecondaryText}>Staff queue (all tickets)</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.btn} onPress={() => router.push('/support/create')}>
        <Text style={styles.btnText}>New ticket</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.filterChip, statusFilter === f.id && styles.filterChipOn]}
            onPress={() => setStatusFilter(f.id)}>
            <Text style={[styles.filterChipText, statusFilter === f.id && styles.filterChipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={NavbarColors.text} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {filteredTickets.map((t) => (
        <Pressable
          key={t.id}
          style={styles.row}
          onPress={() =>
            router.push({ pathname: '/support/ticket/[id]', params: { id: String(t.id) } })
          }>
          <Text style={styles.rowTitle}>{t.public_reference}</Text>
          <Text style={styles.rowSub}>
            {t.status} · {t.handler_team.toUpperCase()} · {t.issue_type.replace(/_/g, ' ')}
          </Text>
        </Pressable>
      ))}
      {tickets.length === 0 && !loading ? <Text style={styles.muted}>No tickets yet.</Text> : null}
      {tickets.length > 0 && filteredTickets.length === 0 && !loading ? (
        <Text style={styles.muted}>No tickets in this status.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: NavbarColors.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  muted: { color: NavbarColors.textMuted, fontSize: 15, marginBottom: 16 },
  btn: {
    backgroundColor: GradientColors.pinkDark,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  filterRow: { marginBottom: 12, maxHeight: 44 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    marginRight: 8,
  },
  filterChipOn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  filterChipText: { color: NavbarColors.textMuted, fontSize: 12 },
  filterChipTextOn: { color: NavbarColors.text, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: NavbarColors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondaryText: { color: NavbarColors.text, fontSize: 15 },
  link: { marginTop: 16, alignSelf: 'center' },
  linkText: { color: GradientColors.pinkLight, fontSize: 15 },
  row: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowTitle: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: NavbarColors.textMuted, fontSize: 13, marginTop: 4 },
  err: { color: '#ff6b6b', marginBottom: 8 },
});
