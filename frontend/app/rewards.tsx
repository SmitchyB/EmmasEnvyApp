import { useRouter } from 'expo-router'; // Import the useRouter hook from expo-router
import React, { useCallback, useEffect, useState } from 'react'; // Import the React, useCallback, useEffect, and useState modules from the react library
import {
  Alert, // Import the Alert component from react-native
  Modal, // Import the Modal component from react-native
  Pressable, // Import the Pressable component from react-native
  ScrollView, // Import the ScrollView component from react-native
  StyleSheet, // Import the StyleSheet component from react-native
  Switch, // Import the Switch component from react-native
  Text, // Import the Text component from react-native
  TextInput, // Import the TextInput component from react-native
  View, // Import the View component from react-native
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import the useSafeAreaInsets hook from react-native-safe-area-context
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors module from @/constants/theme
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook from @/contexts/AuthContext
import { fetchPublicServiceTypes } from '@/lib/booking-api'; // Import the fetchPublicServiceTypes function from @/lib/booking-api
import type { ServiceType } from '@/lib/booking-types'; // Import the ServiceType type from @/lib/booking-types
import { serviceLabel } from '@/lib/newsletters-promos-api'; // Import the serviceLabel function from @/lib/newsletters-promos-api
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole function from @/lib/roles
import {
  createRewardOfferingApi, // Import the createRewardOfferingApi function from @/lib/rewards-api
  deleteRewardOfferingApi, // Import the deleteRewardOfferingApi function from @/lib/rewards-api
  getMeRewards, // Import the getMeRewards function from @/lib/rewards-api
  listAvailableRewardOfferings, // Import the listAvailableRewardOfferings function from @/lib/rewards-api
  listRewardOfferingsAdmin, // Import the listRewardOfferingsAdmin function from @/lib/rewards-api
  patchRewardOfferingApi, // Import the patchRewardOfferingApi function from @/lib/rewards-api
  type MeRewardsResponse, // Import the MeRewardsResponse type from @/lib/rewards-api
  type RewardOfferingDto, // Import the RewardOfferingDto type from @/lib/rewards-api
  type RewardTypeApi, // Import the RewardTypeApi type from @/lib/rewards-api
} from '@/lib/rewards-api';

/* This file is the frontend screen for the rewards. It is used to create, update, and delete rewards. */ 

// Format the offering value
function formatOfferingValue(o: RewardOfferingDto): string {
  if (o.reward_type === 'percent_off' && o.value != null) return `${o.value}% off`; // If the reward type is percent off and the value is not null, return the value as a percentage off
  if (o.reward_type === 'dollar_off' && o.value != null) return `$${o.value} off`; // If the reward type is dollar off and the value is not null, return the value as a dollar off
  if (o.reward_type === 'free_service') return 'Free service'; // If the reward type is free service, return 'Free service'
  return '—'; // Return '—'
}
 
// Return the reward type short
function rewardTypeShort(rt: RewardTypeApi): string {
  if (rt === 'percent_off') return 'Percent off'; // If the reward type is percent off, return 'Percent off'
  if (rt === 'dollar_off') return 'Dollar off'; // If the reward type is dollar off, return 'Dollar off'
  return 'Free service'; // If the reward type is free service, return 'Free service'
}

// Return the rewards screen
export default function RewardsScreen() {
  //All the state variables
  const insets = useSafeAreaInsets(); // Get the insets from the useSafeAreaInsets hook
  const router = useRouter(); // Get the router from the useRouter hook
  const { user, token } = useAuth(); // Get the user and token from the useAuth hook
  const staff = user ? isStaffRole(user.role) : false; // Get the staff from the user role
  const [offerings, setOfferings] = useState<RewardOfferingDto[]>([]); // Get the offerings from the useState hook
  const [catalog, setCatalog] = useState<RewardOfferingDto[]>([]); // Get the catalog from the useState hook
  const [meRewards, setMeRewards] = useState<MeRewardsResponse | null>(null); // Get the me rewards from the useState hook
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]); // Get the service types from the useState hook
  const [loading, setLoading] = useState(true); // Get the loading from the useState hook
  const [modalOpen, setModalOpen] = useState(false); // Get the modal open from the useState hook
  const [editingId, setEditingId] = useState<number | null>(null); // Get the editing id from the useState hook
  const [roTitle, setRoTitle] = useState(''); // Get the ro title from the useState hook
  const [roType, setRoType] = useState<RewardTypeApi>('dollar_off'); // Get the ro type from the useState hook
  const [roPointCost, setRoPointCost] = useState(''); // Get the ro point cost from the useState hook
  const [roValue, setRoValue] = useState(''); // Get the ro value from the useState hook
  const [roMinPurchase, setRoMinPurchase] = useState(''); // Get the ro min purchase from the useState hook
  const [roActive, setRoActive] = useState(true); // Get the ro active from the useState hook
  const [roServiceId, setRoServiceId] = useState<number | null>(null); // Get the ro service id from the useState hook

  // Load the staff
  const loadStaff = useCallback(async () => {
    if (!token) return; // If the token is not found, return
    setLoading(true); // Set the loading to true
    // Try to load the staff
    try {
      const [list, st] = await Promise.all([listRewardOfferingsAdmin(token), fetchPublicServiceTypes()]); // Load the reward offerings and service types
      setOfferings(list); // Set the offerings
      setServiceTypes(st); // Set the service types
    } catch {
      setOfferings([]); // Set the offerings to an empty array
    } finally {
      setLoading(false); // Set the loading to false
    }
  }, [token]); // Load the staff
  // Load the customer
  const loadCustomer = useCallback(async () => {
    if (!token) return; // If the token is not found, return
    setLoading(true); // Set the loading to true
    // Try to load the customer
    try {
      // Load the me rewards, all offers, and service types
      const [mr, allOffers, st] = await Promise.all([
        getMeRewards(token), // Load the me rewards
        listAvailableRewardOfferings(), // Load the available reward offerings
        fetchPublicServiceTypes(), // Load the service types
      ]);
      setMeRewards(mr); // Set the me rewards
      setCatalog(allOffers); // Set the catalog
      setServiceTypes(st); // Set the service types
    } catch {
      setMeRewards(null); // Set the me rewards to null
      setCatalog([]); // Set the catalog to an empty array
    } finally {
      setLoading(false); // Set the loading to false
    }
  }, [token]); // Load the customer

  useEffect(() => {
    if (!user || !token) return; // If the user or token is not found, return
    if (staff) loadStaff(); // If the staff is true, load the staff
    else loadCustomer(); // If the staff is false, load the customer
  }, [user, token, staff, loadStaff, loadCustomer]); // Load the staff and customer

  // Open the new offering
  const openNew = () => {
    setEditingId(null); // Set the editing id to null
    setRoTitle(''); // Set the ro title to an empty string
    setRoType('dollar_off'); // Set the ro type to dollar off
    setRoPointCost(''); // Set the ro point cost to an empty string
    setRoValue(''); // Set the ro value to an empty string
    setRoMinPurchase('0'); // Set the ro min purchase to 0
    setRoActive(true); // Set the ro active to true
    setRoServiceId(null); // Set the ro service id to null
    setModalOpen(true); // Set the modal open to true
  };

  // Open the edit offering
  const openEdit = (o: RewardOfferingDto) => {
    setEditingId(o.id); // Set the editing id to the offering id
    setRoTitle(o.title); // Set the ro title to the offering title
    setRoType(o.reward_type); // Set the ro type to the offering type
    setRoPointCost(String(o.point_cost)); // Set the ro point cost to the offering point cost
    setRoValue(o.value != null ? String(o.value) : ''); // Set the ro value to the offering value
    setRoMinPurchase(o.min_purchase_amount != null ? String(o.min_purchase_amount) : '0'); // Set the ro min purchase to the offering min purchase
    setRoActive(o.is_active); // Set the ro active to the offering active
    setRoServiceId(o.service_type_id); // Set the ro service id to the offering service id
    setModalOpen(true); // Set the modal open to true
  };

  // Save the offering
  const saveOffering = async () => {
    if (!token) return; // If the token is not found, return
    const titleStr = roTitle.trim(); // Get the title from the ro title
    // If the title is not found, return an alert
    if (!titleStr) {
      Alert.alert('Enter a title'); // If the title is not found, return an alert
      return;
    }
    const cost = parseInt(roPointCost, 10); // Get the cost from the ro point cost
    // If the cost is not a number or is less than 0, return an alert
    if (Number.isNaN(cost) || cost <= 0) {
      Alert.alert('Point cost must be a positive number'); // If the cost is not a number or is less than 0, return an alert
      return;
    }
    // If the reward type is free service and the service id is null, return an alert
    if (roType === 'free_service' && roServiceId == null) {
      Alert.alert('Free service rewards must be tied to a specific service.'); // If the reward type is free service and the service id is null, return an alert
      return;
    }
    let valueNum: number | null | undefined; // Let the value number be null or undefined
    // If the reward type is percent off or dollar off, get the value from the ro value
    if (roType === 'percent_off' || roType === 'dollar_off') {
      const v = parseFloat(roValue); // Get the value from the ro value
      // If the value is not a number or is less than 0, return an alert
      if (Number.isNaN(v) || v <= 0) {
        Alert.alert('Enter a positive value for this reward type.'); // If the value is not a number or is less than 0, return an alert
        return;
      }
      // If the reward type is percent off and the value is greater than 100, return an alert
      if (roType === 'percent_off' && v > 100) {
        Alert.alert('Percent cannot exceed 100.'); // If the reward type is percent off and the value is greater than 100, return an alert
        return;
      }
      valueNum = v; // Set the value number to the value
    } 
    // If the reward type is free service, get the value from the ro value
    else {
      valueNum = roValue.trim() === '' ? null : parseFloat(roValue); // Get the value from the ro value
      // If the value is not a number or is less than 0, return an alert
      if (roValue.trim() !== '' && (valueNum == null || Number.isNaN(valueNum) || valueNum < 0)) {
        Alert.alert('Optional value must be non-negative.'); // If the value is not a number or is less than 0, return an alert
        return;
      }
    }
    const minPurchase = roMinPurchase.trim() === '' ? null : parseFloat(roMinPurchase); // Get the minimum purchase from the ro min purchase
    // If the minimum purchase is not a number or is less than 0, return an alert
    if (minPurchase != null && (Number.isNaN(minPurchase) || minPurchase < 0)) {
      Alert.alert('Min purchase must be 0 or greater'); // If the minimum purchase is not a number or is less than 0, return an alert
      return;
    }
    // Try to save the offering
    try {
      // If the editing id is null, create a new offering
      if (editingId == null) {
        // Create a new offering
        await createRewardOfferingApi(token, {
          title: titleStr, // Set the title to the title string
          reward_type: roType, // Set the reward type to the reward type
          point_cost: cost, // Set the point cost to the cost
          value: valueNum ?? null, // Set the value to the value number
          min_purchase_amount: minPurchase, // Set the minimum purchase to the minimum purchase
          is_active: roActive, // Set the active to the active
          service_type_id: roServiceId, // Set the service id to the service id
        });
      } 
      // else update the offering
      else {
        //await to patch the offering
        await patchRewardOfferingApi(token, editingId, {
          title: titleStr, // Set the title to the title string
          reward_type: roType, // Set the reward type to the reward type
          point_cost: cost, // Set the point cost to the cost
          value: valueNum ?? null, // Set the value to the value number
          min_purchase_amount: minPurchase, // Set the minimum purchase to the minimum purchase
          is_active: roActive, // Set the active to the active
          service_type_id: roServiceId, // Set the service id to the service id
        });
      }
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.'); // If there is an error, return an alert
    }
  };
  // Remove the offering
  const removeOffering = (id: number) => {
    if (!token) return; // If the token is not found, return
    // Show an alert that the delete offering
    Alert.alert('Delete offering', 'Remove this reward offering?', [
      { text: 'Cancel', style: 'cancel' }, // Show an alert that the cancel is clicked
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteRewardOfferingApi(token, id); await loadStaff(); } catch (e) { Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'); } }, }, // Show an alert that the delete is clicked
    ]);
  };
  // If the user is not found, return
  if (!user) {
    // Return the prompt to sign in
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 40, paddingHorizontal: 24 }]}>
        <Text style={styles.muted}>Sign in to view rewards.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const customerPoints = meRewards?.points ?? user.reward_points ?? 0; // Get the customer points from the me rewards
  // Return the rewards screen
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Rewards</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : staff ? (
          <>
            <Text style={styles.sectionTitle}>Offerings (manage)</Text>
            <Pressable style={styles.primaryOutline} onPress={openNew}>
              <Text style={styles.primaryOutlineText}>+ Add offering</Text>
            </Pressable>
            {offerings.length === 0 ? (
              <Text style={styles.muted}>No reward offerings yet.</Text>
            ) : (
              offerings.map((o) => {
                const st = o.service_type_id != null ? serviceTypes.find((s) => s.id === o.service_type_id) : null;
                return (
                  <View key={o.id} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {o.title}
                      {o.is_active ? '' : ' (inactive)'}
                    </Text>
                    <Text style={styles.cardSub}>
                      {rewardTypeShort(o.reward_type)} · {formatOfferingValue(o)} · {o.point_cost} pts
                    </Text>
                    <Text style={styles.cardMeta}>
                      {o.service_type_id != null
                        ? `Service: ${st ? serviceLabel(st) : `#${o.service_type_id}`}`
                        : 'Any service'}
                    </Text>
                    <View style={styles.cardRow}>
                      <Pressable style={styles.smallBtn} onPress={() => openEdit(o)}>
                        <Text style={styles.smallBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.smallBtnDanger} onPress={() => removeOffering(o.id)}>
                        <Text style={styles.smallBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your points</Text>
            <View style={styles.pointsCard}>
              <Text style={styles.pointsValue}>{customerPoints}</Text>
              <Text style={styles.pointsLabel}>Available balance</Text>
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Redeem at checkout</Text>
            <Text style={styles.muted}>
              Choose a reward below and ask your stylist to apply it when you pay. Points are deducted when your visit is
              checked out.
            </Text>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Offerings</Text>
            {catalog.length === 0 ? (
              <Text style={styles.muted}>No active offerings right now.</Text>
            ) : (
              catalog.map((o) => {
                const affordable = customerPoints >= o.point_cost;
                const st = o.service_type_id != null ? serviceTypes.find((s) => s.id === o.service_type_id) : null;
                return (
                  <View key={o.id} style={[styles.card, !affordable && styles.cardLocked]}>
                    <Text style={styles.cardTitle}>{o.title}</Text>
                    <Text style={styles.cardSub}>
                      {formatOfferingValue(o)} · {o.point_cost} pts
                      {!affordable ? ' · Need more points' : ''}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {o.min_purchase_amount != null && o.min_purchase_amount > 0
                        ? `Min. purchase $${o.min_purchase_amount}`
                        : 'No minimum purchase'}
                      {o.service_type_id != null
                        ? ` · ${st ? serviceLabel(st) : `Service #${o.service_type_id}`}`
                        : ' · Any service'}
                    </Text>
                  </View>
                );
              })
            )}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>History</Text>
            {!meRewards?.reward_history?.length ? (
              <Text style={styles.muted}>No redemptions yet.</Text>
            ) : (
              meRewards.reward_history.map((h) => (
                <View key={`${h.invoice_id}-${h.created_at}`} style={styles.card}>
                  <Text style={styles.cardTitle}>{h.reward_title}</Text>
                  <Text style={styles.cardSub}>
                    −{h.points_used} pts · {String(h.created_at).slice(0, 10)} · Invoice {h.invoice_id}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {staff ? (
        <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={{ maxHeight: '92%' }}
              contentContainerStyle={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.modalTitle}>{editingId == null ? 'New offering' : 'Edit offering'}</Text>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={roTitle}
                onChangeText={setRoTitle}
                placeholderTextColor={NavbarColors.textMuted}
              />
              <Text style={styles.label}>Reward type</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  style={[styles.segment, roType === 'percent_off' && styles.segmentActive]}
                  onPress={() => setRoType('percent_off')}>
                  <Text style={styles.segmentText}>% off</Text>
                </Pressable>
                <Pressable
                  style={[styles.segment, roType === 'dollar_off' && styles.segmentActive]}
                  onPress={() => setRoType('dollar_off')}>
                  <Text style={styles.segmentText}>$ off</Text>
                </Pressable>
                <Pressable
                  style={[styles.segment, roType === 'free_service' && styles.segmentActive]}
                  onPress={() => setRoType('free_service')}>
                  <Text style={styles.segmentText}>Free svc</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>Point cost</Text>
              <TextInput
                style={styles.input}
                value={roPointCost}
                onChangeText={setRoPointCost}
                keyboardType="number-pad"
                placeholderTextColor={NavbarColors.textMuted}
              />
              {roType === 'free_service' ? (
                <>
                  <Text style={styles.label}>Optional extra value (usually leave empty)</Text>
                  <TextInput
                    style={styles.input}
                    value={roValue}
                    onChangeText={setRoValue}
                    keyboardType="decimal-pad"
                    placeholderTextColor={NavbarColors.textMuted}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>{roType === 'percent_off' ? 'Percent off' : 'Amount ($) off'}</Text>
                  <TextInput
                    style={styles.input}
                    value={roValue}
                    onChangeText={setRoValue}
                    keyboardType="decimal-pad"
                    placeholderTextColor={NavbarColors.textMuted}
                  />
                </>
              )}
              <Text style={styles.label}>Min purchase ($)</Text>
              <TextInput
                style={styles.input}
                value={roMinPurchase}
                onChangeText={setRoMinPurchase}
                keyboardType="decimal-pad"
                placeholderTextColor={NavbarColors.textMuted}
              />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Active</Text>
                <Switch value={roActive} onValueChange={setRoActive} />
              </View>
              <Text style={styles.label}>{roType === 'free_service' ? 'Service (required)' : 'Applies to service'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {roType !== 'free_service' ? (
                  <Pressable
                    style={[styles.chip, roServiceId === null && styles.chipActive]}
                    onPress={() => setRoServiceId(null)}>
                    <Text style={styles.chipText}>Any</Text>
                  </Pressable>
                ) : null}
                {serviceTypes.map((s) => (
                  <Pressable
                    key={s.id}
                    style={[styles.chip, roServiceId === s.id && styles.chipActive]}
                    onPress={() => setRoServiceId(s.id)}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {serviceLabel(s)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {roType === 'free_service' ? (
                <Text style={[styles.muted, { marginTop: 6 }]}>
                  Free service rewards must be linked to a specific service.
                </Text>
              ) : null}
              <View style={styles.modalRow}>
                <Pressable style={styles.modalSecondary} onPress={() => setModalOpen(false)}>
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalPrimary} onPress={saveOffering}>
                  <Text style={styles.modalPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Modal>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    fontSize: 17,
    fontWeight: '700',
    color: NavbarColors.text,
    flex: 1,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: NavbarColors.text,
  },
  muted: {
    color: NavbarColors.textMuted,
    fontSize: 15,
  },
  primaryOutline: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    marginBottom: 4,
  },
  primaryOutlineText: {
    color: NavbarColors.text,
    fontWeight: '600',
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  cardLocked: {
    opacity: 0.65,
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
    marginTop: 6,
    fontSize: 13,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
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
  pointsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(194,24,91,0.2)',
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: NavbarColors.text,
  },
  pointsLabel: {
    color: NavbarColors.textMuted,
    fontSize: 14,
    marginTop: 4,
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
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(194,24,91,0.35)',
    borderColor: 'rgba(194,24,91,0.8)',
  },
  segmentText: {
    color: NavbarColors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chipsScroll: {
    marginTop: 8,
    maxHeight: 44,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    marginRight: 8,
    maxWidth: 200,
  },
  chipActive: {
    backgroundColor: 'rgba(194,24,91,0.35)',
    borderColor: 'rgba(194,24,91,0.8)',
  },
  chipText: {
    color: NavbarColors.text,
    fontSize: 13,
  },
});
