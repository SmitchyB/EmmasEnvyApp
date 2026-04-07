import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavbarColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPublicServiceTypes } from '@/lib/booking-api';
import type { ServiceType } from '@/lib/booking-types';
import { serviceLabel } from '@/lib/newsletters-promos-api';
import { isStaffRole } from '@/lib/roles';
import {
  createRewardOfferingApi,
  deleteRewardOfferingApi,
  getMeRewards,
  listAvailableRewardOfferings,
  listRewardOfferingsAdmin,
  patchRewardOfferingApi,
  type MeRewardsResponse,
  type RewardOfferingDto,
  type RewardTypeApi,
} from '@/lib/rewards-api';

function formatOfferingValue(o: RewardOfferingDto): string {
  if (o.reward_type === 'percent_off' && o.value != null) return `${o.value}% off`;
  if (o.reward_type === 'dollar_off' && o.value != null) return `$${o.value} off`;
  if (o.reward_type === 'free_service') return 'Free service';
  return '—';
}

function rewardTypeShort(rt: RewardTypeApi): string {
  if (rt === 'percent_off') return 'Percent off';
  if (rt === 'dollar_off') return 'Dollar off';
  return 'Free service';
}

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();
  const staff = user ? isStaffRole(user.role) : false;

  const [offerings, setOfferings] = useState<RewardOfferingDto[]>([]);
  const [catalog, setCatalog] = useState<RewardOfferingDto[]>([]);
  const [meRewards, setMeRewards] = useState<MeRewardsResponse | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roTitle, setRoTitle] = useState('');
  const [roType, setRoType] = useState<RewardTypeApi>('dollar_off');
  const [roPointCost, setRoPointCost] = useState('');
  const [roValue, setRoValue] = useState('');
  const [roMinPurchase, setRoMinPurchase] = useState('');
  const [roActive, setRoActive] = useState(true);
  const [roServiceId, setRoServiceId] = useState<number | null>(null);

  const loadStaff = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([listRewardOfferingsAdmin(token), fetchPublicServiceTypes()]);
      setOfferings(list);
      setServiceTypes(st);
    } catch {
      setOfferings([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadCustomer = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [mr, allOffers, st] = await Promise.all([
        getMeRewards(token),
        listAvailableRewardOfferings(),
        fetchPublicServiceTypes(),
      ]);
      setMeRewards(mr);
      setCatalog(allOffers);
      setServiceTypes(st);
    } catch {
      setMeRewards(null);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user || !token) return;
    if (staff) loadStaff();
    else loadCustomer();
  }, [user, token, staff, loadStaff, loadCustomer]);

  const openNew = () => {
    setEditingId(null);
    setRoTitle('');
    setRoType('dollar_off');
    setRoPointCost('');
    setRoValue('');
    setRoMinPurchase('0');
    setRoActive(true);
    setRoServiceId(null);
    setModalOpen(true);
  };

  const openEdit = (o: RewardOfferingDto) => {
    setEditingId(o.id);
    setRoTitle(o.title);
    setRoType(o.reward_type);
    setRoPointCost(String(o.point_cost));
    setRoValue(o.value != null ? String(o.value) : '');
    setRoMinPurchase(o.min_purchase_amount != null ? String(o.min_purchase_amount) : '0');
    setRoActive(o.is_active);
    setRoServiceId(o.service_type_id);
    setModalOpen(true);
  };

  const saveOffering = async () => {
    if (!token) return;
    const titleStr = roTitle.trim();
    if (!titleStr) {
      Alert.alert('Enter a title');
      return;
    }
    const cost = parseInt(roPointCost, 10);
    if (Number.isNaN(cost) || cost <= 0) {
      Alert.alert('Point cost must be a positive number');
      return;
    }
    if (roType === 'free_service' && roServiceId == null) {
      Alert.alert('Free service rewards must be tied to a specific service.');
      return;
    }
    let valueNum: number | null | undefined;
    if (roType === 'percent_off' || roType === 'dollar_off') {
      const v = parseFloat(roValue);
      if (Number.isNaN(v) || v <= 0) {
        Alert.alert('Enter a positive value for this reward type.');
        return;
      }
      if (roType === 'percent_off' && v > 100) {
        Alert.alert('Percent cannot exceed 100.');
        return;
      }
      valueNum = v;
    } else {
      valueNum = roValue.trim() === '' ? null : parseFloat(roValue);
      if (roValue.trim() !== '' && (valueNum == null || Number.isNaN(valueNum) || valueNum < 0)) {
        Alert.alert('Optional value must be non-negative.');
        return;
      }
    }
    const minPurchase =
      roMinPurchase.trim() === '' ? null : parseFloat(roMinPurchase);
    if (minPurchase != null && (Number.isNaN(minPurchase) || minPurchase < 0)) {
      Alert.alert('Min purchase must be 0 or greater');
      return;
    }
    try {
      if (editingId == null) {
        await createRewardOfferingApi(token, {
          title: titleStr,
          reward_type: roType,
          point_cost: cost,
          value: valueNum ?? null,
          min_purchase_amount: minPurchase,
          is_active: roActive,
          service_type_id: roServiceId,
        });
      } else {
        await patchRewardOfferingApi(token, editingId, {
          title: titleStr,
          reward_type: roType,
          point_cost: cost,
          value: valueNum ?? null,
          min_purchase_amount: minPurchase,
          is_active: roActive,
          service_type_id: roServiceId,
        });
      }
      setModalOpen(false);
      await loadStaff();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const removeOffering = (id: number) => {
    if (!token) return;
    Alert.alert('Delete offering', 'Remove this reward offering?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRewardOfferingApi(token, id);
            await loadStaff();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 40, paddingHorizontal: 24 }]}>
        <Text style={styles.muted}>Sign in to view rewards.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const customerPoints = meRewards?.points ?? user.reward_points ?? 0;

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
