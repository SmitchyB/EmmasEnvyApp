import { useRouter } from 'expo-router'; // Import the useRouter from expo-router for the router
import React from 'react'; // Import the React from react for the component
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'; // Import the Pressable, ScrollView, StyleSheet, Text, and View from react-native for the components
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors from @/constants/theme for the colors
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth from @/contexts/AuthContext for the authentication

// Define the placeholder invoice interface
interface PlaceholderInvoice {
  id: number; // ID of the invoice
  invoice_id: string; // Invoice ID
  created_at: string; // Created at date
  total_amount: number; // Total amount of the invoice
  currency: string; // Currency of the invoice
  payment_status: string; // Payment status of the invoice
}

// Define the placeholder invoices
const PLACEHOLDER_INVOICES: PlaceholderInvoice[] = [
  { id: 1, invoice_id: 'INV-001', created_at: '2025-03-10T12:00:00Z', total_amount: 49.99, currency: 'USD', payment_status: 'Paid' },
  { id: 2, invoice_id: 'INV-002', created_at: '2025-03-08T09:30:00Z', total_amount: 129.5, currency: 'USD', payment_status: 'Paid' },
  { id: 3, invoice_id: 'INV-003', created_at: '2025-03-01T14:15:00Z', total_amount: 24.99, currency: 'USD', payment_status: 'Paid' },
];

// Define the format date function
function formatDate(iso: string): string {
  // Try to format the date
  try {
    const d = new Date(iso); // Create a new date object from the ISO string
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); // Format the date to the locale date string
  } catch {
    return iso; // If the date is not valid, return the ISO string
  }
}
// Define the format currency function
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
}
// Define the purchases screen component
export default function PurchasesScreen() {
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets
  const { user } = useAuth(); // Get the user from the useAuth
  const router = useRouter(); // Get the router from the useRouter
  const invoices = PLACEHOLDER_INVOICES; // Get the invoices from the PLACEHOLDER_INVOICES
  // If the user is not valid, return the sign in to view purchases component
  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.subtitle}>Sign in to view purchases</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }
  // If the user is valid, return the purchases screen with the invoices
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Purchases</Text>
      {invoices.length === 0 ? (
        <Text style={styles.muted}>No purchases yet.</Text>
      ) : (
        invoices.map((inv) => (
          <View key={inv.id} style={styles.card}>
            <Text style={styles.invoiceId}>{inv.invoice_id}</Text>
            <Text style={styles.date}>{formatDate(inv.created_at)}</Text>
            <Text style={styles.amount}>{formatCurrency(inv.total_amount, inv.currency)}</Text>
            <Text style={styles.status}>Status: {inv.payment_status}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
 
// Define the styles for the purchases screen
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backButtonText: { color: NavbarColors.text, fontSize: 16 },
  subtitle: { color: NavbarColors.textMuted, marginBottom: 16, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: NavbarColors.text, marginBottom: 16 },
  muted: { color: NavbarColors.textMuted, fontSize: 15 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  invoiceId: { color: NavbarColors.text, fontSize: 16, fontWeight: '600' },
  date: { color: NavbarColors.textMuted, fontSize: 14, marginTop: 4 },
  amount: { color: NavbarColors.text, fontSize: 15, marginTop: 4 },
  status: { color: NavbarColors.textMuted, fontSize: 13, marginTop: 4 },
});
