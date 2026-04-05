import { useRouter } from 'expo-router'; // Import the useRouter module from the expo-router library
import React, { useCallback, useEffect, useState } from 'react'; // Import the React, useCallback, useEffect, and useState modules from the react library
import {
  Alert, // Import the Alert module from the react-native library
  Modal, // Import the Modal module from the react-native library
  Pressable, // Import the Pressable module from the react-native library
  ScrollView, // Import the ScrollView module from the react-native library
  StyleSheet, // Import the StyleSheet module from the react-native library
  Text, // Import the Text module from the react-native library
  TextInput, // Import the TextInput module from the react-native library
  View, // Import the View module from the react-native library
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets module from the react-native-safe-area-context library
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors module from the constants/theme file
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth module from the contexts/AuthContext file
import {
  createServiceTypeApi, // Import the createServiceTypeApi module from the booking-api file
  deleteServiceTypeApi, // Import the deleteServiceTypeApi module from the booking-api file
  listMyServiceTypes, // Import the listMyServiceTypes module from the booking-api file
  updateServiceTypeApi, // Import the updateServiceTypeApi module from the booking-api file
} from '@/lib/booking-api';
import type { ServiceType } from '@/lib/booking-types'; // Import the ServiceType type from the booking-types file
import { minutesToDurationString } from '@/lib/booking-duration'; // Import the minutesToDurationString module from the booking-duration file
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole module from the roles file

// Function to return the my services screen
export default function MyServicesScreen() {
  const insets = useSafeAreaInsets(); // Read safe-area padding for header and modal
  const router = useRouter(); // Stack navigation for back from this screen
  const { user, token } = useAuth(); // Session for staff-only APIs
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]); // Rows returned from listMyServiceTypes
  const [loading, setLoading] = useState(true); // True while first fetch or refresh runs

  // Function to load the signed-in stylist’s service types from the API
  const load = useCallback(async () => {
    if (!token) return; // Anonymous users cannot call staff endpoints
    setLoading(true); // Show loading state in list area
    try {
      const list = await listMyServiceTypes(token); // GET /api/me/service-types
      setServiceTypes(list); // Replace local list
    } catch {
      setServiceTypes([]); // Fail closed to empty list
    } finally {
      setLoading(false); // Always clear spinner
    }
  }, [token]);

  //useEffect to load the service types
  useEffect(() => {
    load(); // Initial load when token or callback identity changes
  }, [load]);

  const [editorOpen, setEditorOpen] = useState(false); // Modal visibility for create/edit form
  const [editingId, setEditingId] = useState<number | null>(null); // Null means create; number means update
  const [title, setTitle] = useState(''); // Service title field
  const [description, setDescription] = useState(''); // Optional long description
  const [durationMin, setDurationMin] = useState('60'); // Whole minutes as string for TextInput
  const [price, setPrice] = useState(''); // Decimal string or empty
  const [tags, setTags] = useState(''); // Comma-separated tags before split

  // If the user is not a staff member, show an alert
  if (!user || !isStaffRole(user.role)) {
    //Return the alert
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.muted}>You do not have access to this screen.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Function to open the modal in create mode with empty defaults
  const openNew = () => {
    setEditingId(null); // POST path
    setTitle(''); // Clear title
    setDescription(''); // Clear description
    setDurationMin('60'); // Sensible default duration
    setPrice(''); // Optional price
    setTags(''); // Optional tags
    setEditorOpen(true); // Show sheet
  };

  // Function to hydrate modal fields from an existing service type row
  const openEdit = (id: number) => {
    const s = serviceTypes.find((x) => x.id === id); // Locate row by id
    if (!s) return; // Stale list guard
    setEditingId(id); // PUT path
    setTitle(s.title); // Copy title
    setDescription(s.description ?? ''); // Copy description or blank
    const mins = s.duration_needed?.match(/^(\d+):(\d+)/); // Parse HH:MM:SS prefix
    // If the mins are not null, parse the hours and minutes
    const total =
      mins != null ? parseInt(mins[1], 10) * 60 + parseInt(mins[2], 10) : 60; // Whole minutes for editor
    setDurationMin(String(total)); // String for TextInput
    setPrice(s.price != null ? String(s.price) : ''); // Numeric to string
    setTags(s.tags?.join(', ') ?? ''); // Array to comma list
    setEditorOpen(true); // Show sheet
  };

  // Function to validate form and create or update via booking API
  const save = async () => {
    // If the token is not set, return
    if (!token) return; // Need bearer for staff routes
    const t = title.trim(); // Non-empty title rule
    // If the title is not set, show an alert
    if (!t) {
      Alert.alert('Title required'); // Block save
      return;
    }
    const dm = parseInt(durationMin, 10); // Parse minutes
    // If the duration is not a number or is less than 0, show an alert
    if (Number.isNaN(dm) || dm <= 0) {
      Alert.alert('Enter duration in minutes'); // Reject bad input
      return;
    }
    const durStr = minutesToDurationString(dm); // HH:MM:00 for Postgres interval
    const p = price.trim() === '' ? null : Number(price); // Optional decimal
    // If the tags are not set, show an alert
    const tagArr = tags
      .split(',') // Split on commas
      .map((x) => x.trim()) // Trim each token
      .filter(Boolean); // Drop empties
    // Try to create or update the service type
    try {
      if (editingId == null) {
        // Await the create service type api
        await createServiceTypeApi(token, {
          title: t, // Set the title
          description: description.trim() || null, // Set the description
          duration_needed: durStr, // Set the duration
          price: p != null && !Number.isNaN(p) ? p : null, // Set the price 
          tags: tagArr.length ? tagArr : null, // Set the tags
        }); // POST new row
      } else {
        // Await the update service type api
        await updateServiceTypeApi(token, editingId, {
          title: t, // Set the title
          description: description.trim() || null, // Set the description
          duration_needed: durStr, // Set the duration
          price: p != null && !Number.isNaN(p) ? p : null, // Set the price
          tags: tagArr.length ? tagArr : null, // Set the tags
        }); // PUT existing row
      }
      setEditorOpen(false); // Close modal on success
      await load(); // Refresh cards
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.'); // Surface API error
    }
  };

  // Function to confirm then delete a service type and refresh the list
  const remove = (id: number) => {
    // If the token is not set, return
    if (!token) return; // Need auth
    // Show an alert to the user that they want to delete the service type
    Alert.alert('Delete service', 'Remove this service type?', [
      { text: 'Cancel', style: 'cancel' }, // Set the alert to the cancel message
      {
        text: 'Delete', // Set the alert to the delete message 
        style: 'destructive', // Set the alert to the destructive message
        // On press, try to delete the service type
        onPress: async () => {
          // Try to delete the service type
          try {
            await deleteServiceTypeApi(token, id); // DELETE row
            await load(); // Sync UI
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'); // Show failure
          }
        },
      },
    ]);
  };
  // Return the my services screen
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Services</Text>
        <Pressable onPress={openNew}>
          <Text style={styles.add}>Add</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : serviceTypes.length === 0 ? (
          <Text style={styles.muted}>No services yet. Tap Add to create one.</Text>
        ) : (
          serviceTypes.map((s) => (
            <View key={s.id} style={styles.card}>
              <Text style={styles.cardTitle}>{s.title}</Text>
              {s.description ? <Text style={styles.cardSub}>{s.description}</Text> : null}
              <Text style={styles.cardMeta}>
                ${s.price ?? 0} · duration {s.duration_needed ?? '—'}
              </Text>
              <View style={styles.cardRow}>
                <Pressable style={styles.smallBtn} onPress={() => openEdit(s.id)}>
                  <Text style={styles.smallBtnText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.smallBtnDanger} onPress={() => remove(s.id)}>
                  <Text style={styles.smallBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{editingId == null ? 'New service' : 'Edit service'}</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={NavbarColors.textMuted} />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={NavbarColors.textMuted}
              multiline
            />
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="number-pad"
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Tags (comma-separated)</Text>
            <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholderTextColor={NavbarColors.textMuted} />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalSecondary} onPress={() => setEditorOpen(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={save}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  back: {
    color: NavbarColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
  },
  add: {
    color: NavbarColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 24,
    gap: 12,
  },
  muted: {
    color: NavbarColors.textMuted,
    fontSize: 15,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.12)',
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
  cardRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  smallBtnDanger: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,100,100,0.5)',
  },
  smallBtnText: {
    color: NavbarColors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  btn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(194,24,91,0.85)',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'rgba(18,10,16,0.98)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: NavbarColors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NavbarColors.text,
    marginBottom: 12,
  },
  label: {
    color: NavbarColors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: NavbarColors.border,
    borderRadius: 10,
    padding: 12,
    color: NavbarColors.text,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: NavbarColors.text,
    fontWeight: '600',
  },
  modalPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(194,24,91,0.9)',
    alignItems: 'center',
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
