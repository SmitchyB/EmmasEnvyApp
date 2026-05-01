//Staff Queue Screen that shows the staff queue
import { useRouter } from 'expo-router'; // Import the useRouter module from expo-router
import React, { useCallback, useEffect, useState } from 'react'; // Import the React, useCallback, useEffect, and useState modules from react
import {
  ActivityIndicator, // Import the ActivityIndicator module from react-native
  Pressable,  // Import the Pressable module from react-native
  ScrollView, // Import the ScrollView module from react-native
  StyleSheet, // Import the StyleSheet module from react-native
  Text, // Import the Text module from react-native
  View, // Import the View module from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from react-native-safe-area-context
import { GradientColors, NavbarColors } from '@/constants/theme'; // Import the GradientColors and NavbarColors modules from @/constants/theme
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from @/contexts/AuthContext
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole module from @/lib/roles
import { listStaffTickets } from '@/lib/tickets-api'; // Import the listStaffTickets module from @/lib/tickets-api
import type { SupportTicket, SupportTicketStatus } from '@/lib/ticket-types'; // Import the SupportTicket and SupportTicketStatus types from @/lib/ticket-types

//Define the status filters for the support tickets
const QUEUE_STATUS_FILTERS: { id: 'all' | SupportTicketStatus; label: string }[] = [
  { id: 'all', label: 'All' }, // All tickets
  { id: 'open', label: 'Open' }, // Open tickets
  { id: 'pending_customer', label: 'Pending customer' }, // Pending customer
  { id: 'pending_staff', label: 'Pending staff' }, // Pending staff
  { id: 'resolved', label: 'Resolved' }, // Resolved
  { id: 'closed', label: 'Closed' }, // Closed
];

//Define the SupportStaffQueueScreen component
export default function SupportStaffQueueScreen() {
  //All the state variables are defined here
  const insets = useSafeAreaInsets(); // Get the safe area insets
  const router = useRouter(); // Get the router for navigation
  const { user, token } = useAuth(); // Get the user and token from the useAuth module
  const [tickets, setTickets] = useState<SupportTicket[]>([]); // Initialize the tickets state
  const [filter, setFilter] = useState<'all' | 'admin' | 'it'>('all'); // Initialize the filter state
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all'); // Initialize the status filter state
  const [loading, setLoading] = useState(false); // Initialize the loading state
  const [error, setError] = useState<string | null>(null); // Initialize the error state

  //define the load function to load the tickets
  const load = useCallback(async () => {
    if (!token || !user || !isStaffRole(user.role)) return; // If the token or user or role is not found, return
    setLoading(true); // Set the loading state to true
    setError(null); // Set the error state to null
    // Try to load the tickets
    try {
      // Load the tickets
      const list = await listStaffTickets(token, {
        handler_team: filter === 'all' ? undefined : filter, // Set the handler team
        status: statusFilter === 'all' ? undefined : statusFilter, // Set the status
        limit: 50, // Set the limit
      });
      setTickets(list); // Set the tickets state
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed'); // Set the error state to the error message
    } finally {
      setLoading(false); // Set the loading state to false
    }
  }, [token, user, filter, statusFilter]); // Dependencies for the load function

  //useEffect hook to load the tickets when the screen is focused
  useEffect(() => {
    void load(); // Load the tickets
  }, [load]);

  // If the user or role is not found, return a view with a muted text, a button to go back, and a centered view
  if (!user || !isStaffRole(user.role)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.muted}>Staff only.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  //Return a view with a title, a filter heading, a filter for the team, a filter for the status, a list of the tickets, a loading indicator, and an error text
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Support queue</Text>
      <Text style={styles.filterHeading}>Team</Text>
      <View style={styles.filters}>
        {(['all', 'admin', 'it'] as const).map((f) => (
          <Pressable key={f} style={[styles.filterChip, filter === f && styles.filterChipOn]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>{f.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.filterHeading}>Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterRow}>
        {QUEUE_STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.filterChip, statusFilter === f.id && styles.filterChipOn]}
            onPress={() => setStatusFilter(f.id)}>
            <Text style={[styles.filterText, statusFilter === f.id && styles.filterTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={NavbarColors.text} style={{ marginVertical: 12 }} /> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {tickets.map((t) => (
        <Pressable
          key={t.id}
          style={styles.row}
          onPress={() =>
            router.push({ pathname: '/support/ticket/[id]', params: { id: String(t.id) } })
          }>
          <Text style={styles.rowTitle}>
            {t.public_reference} · {t.handler_team.toUpperCase()}
          </Text>
          <Text style={styles.rowSub}>
            {t.status} · user {t.user_id ?? 'guest'} · {t.issue_type.replace(/_/g, ' ')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: NavbarColors.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  muted: { color: NavbarColors.textMuted },
  filterHeading: { color: NavbarColors.textMuted, fontSize: 12, marginBottom: 6 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusFilterRow: { marginBottom: 12, maxHeight: 44 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  filterChipOn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  filterText: { color: NavbarColors.textMuted, fontSize: 12 },
  filterTextOn: { color: NavbarColors.text, fontWeight: '700' },
  btn: {
    marginTop: 16,
    backgroundColor: GradientColors.pinkDark,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: NavbarColors.text, fontWeight: '600' },
  row: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowTitle: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: NavbarColors.textMuted, fontSize: 13, marginTop: 4 },
  err: { color: '#ff6b6b' },
});
