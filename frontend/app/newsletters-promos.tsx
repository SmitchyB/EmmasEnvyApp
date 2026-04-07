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
import {
  createNewsletterApi,
  createPromoCodeApi,
  deleteNewsletterApi,
  deletePromoCodeApi,
  listNewslettersApi,
  listPromoCodes,
  patchNewsletterApi,
  patchPromoCodeApi,
  sendNewsletterApi,
  serviceLabel,
  type NewsletterDto,
  type PromoCodeDto,
} from '@/lib/newsletters-promos-api';
import { isStaffRole } from '@/lib/roles';

export default function NewslettersPromosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();
  const [promos, setPromos] = useState<PromoCodeDto[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoEditingId, setPromoEditingId] = useState<number | null>(null);
  const [pcCode, setPcCode] = useState('');
  const [pcDiscMode, setPcDiscMode] = useState<'percent' | 'dollar'>('percent');
  const [pcDiscVal, setPcDiscVal] = useState('');
  const [pcMin, setPcMin] = useState('0');
  const [pcExp, setPcExp] = useState('');
  const [pcUsageLimit, setPcUsageLimit] = useState('');
  const [pcActive, setPcActive] = useState(true);
  const [pcServiceId, setPcServiceId] = useState<number | null>(null);

  const [nlModalOpen, setNlModalOpen] = useState(false);
  const [nlEditingId, setNlEditingId] = useState<number | null>(null);
  const [nlSubject, setNlSubject] = useState('');
  const [nlContent, setNlContent] = useState('');
  const [nlPromoId, setNlPromoId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [pl, nl, st] = await Promise.all([
        listPromoCodes(token),
        listNewslettersApi(token),
        fetchPublicServiceTypes(),
      ]);
      setPromos(pl);
      setNewsletters(nl);
      setServiceTypes(st);
    } catch {
      setPromos([]);
      setNewsletters([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openNewPromo = () => {
    setPromoEditingId(null);
    setPcCode('');
    setPcDiscMode('percent');
    setPcDiscVal('');
    setPcMin('0');
    setPcExp('');
    setPcUsageLimit('');
    setPcActive(true);
    setPcServiceId(null);
    setPromoModalOpen(true);
  };

  const openEditPromo = (p: PromoCodeDto) => {
    setPromoEditingId(p.id);
    setPcCode(p.code);
    setPcDiscMode(p.discount_type === 'flat_amount' ? 'dollar' : 'percent');
    setPcDiscVal(String(p.discount_value));
    setPcMin(String(p.min_purchase_amount ?? 0));
    setPcExp(p.expiration_date ? String(p.expiration_date).slice(0, 10) : '');
    setPcUsageLimit(p.usage_limit != null ? String(p.usage_limit) : '');
    setPcActive(p.is_active);
    setPcServiceId(p.service_type_id);
    setPromoModalOpen(true);
  };

  const savePromo = async () => {
    if (!token) return;
    const val = parseFloat(pcDiscVal);
    if (Number.isNaN(val) || val <= 0) {
      Alert.alert('Enter a positive discount value');
      return;
    }
    const minPurchase = parseFloat(pcMin);
    if (Number.isNaN(minPurchase) || minPurchase < 0) {
      Alert.alert('Min purchase must be 0 or greater');
      return;
    }
    const usageLimit =
      pcUsageLimit.trim() === '' ? null : parseInt(pcUsageLimit, 10);
    if (pcUsageLimit.trim() !== '' && (Number.isNaN(usageLimit!) || usageLimit! < 0)) {
      Alert.alert('Usage limit must be empty or a non-negative integer');
      return;
    }
    const exp = pcExp.trim() === '' ? null : pcExp.trim();
    const dt = pcDiscMode === 'percent' ? 'percent' : 'fixed';
    try {
      if (promoEditingId == null) {
        const c = pcCode.trim();
        if (!c) {
          Alert.alert('Code is required');
          return;
        }
        await createPromoCodeApi(token, {
          code: c,
          discount_type: dt,
          discount_value: val,
          min_purchase_amount: minPurchase,
          expiration_date: exp,
          usage_limit: usageLimit,
          is_active: pcActive,
          service_type_id: pcServiceId,
        });
      } else {
        await patchPromoCodeApi(token, promoEditingId, {
          discount_type: dt,
          discount_value: val,
          min_purchase_amount: minPurchase,
          expiration_date: exp,
          usage_limit: usageLimit,
          is_active: pcActive,
          service_type_id: pcServiceId,
        });
      }
      setPromoModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const removePromo = (id: number) => {
    if (!token) return;
    Alert.alert('Delete promo', 'Remove this promo code?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePromoCodeApi(token, id);
            await load();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const openNewNewsletter = () => {
    setNlEditingId(null);
    setNlSubject('');
    setNlContent('');
    setNlPromoId(null);
    setNlModalOpen(true);
  };

  const openEditNewsletter = (n: NewsletterDto) => {
    if (n.sent_at) {
      Alert.alert('Read only', 'Sent newsletters cannot be edited.');
      return;
    }
    setNlEditingId(n.id);
    setNlSubject(n.subject);
    setNlContent(n.content ?? '');
    setNlPromoId(n.promo_code_id);
    setNlModalOpen(true);
  };

  const insertPromoIntoContent = () => {
    const pid = nlPromoId;
    if (pid == null) {
      Alert.alert('Select a promo', 'Choose a promo code in the newsletter form first.');
      return;
    }
    const p = promos.find((x) => x.id === pid);
    if (!p) {
      Alert.alert('Promo not found', 'Reload and try again.');
      return;
    }
    const line = `\n\nUse code: ${p.code}\n`;
    setNlContent((c) => (c.endsWith('\n') || c === '' ? `${c}${line.trimStart()}` : `${c}${line}`));
  };

  const saveNewsletter = async () => {
    if (!token) return;
    const subj = nlSubject.trim();
    if (!subj) {
      Alert.alert('Subject is required');
      return;
    }
    try {
      if (nlEditingId == null) {
        await createNewsletterApi(token, {
          subject: subj,
          content: nlContent,
          promo_code_id: nlPromoId,
        });
      } else {
        await patchNewsletterApi(token, nlEditingId, {
          subject: subj,
          content: nlContent,
          promo_code_id: nlPromoId,
        });
      }
      setNlModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const sendNewsletter = (id: number) => {
    if (!token) return;
    Alert.alert('Send newsletter', 'Mark this newsletter as sent?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            await sendNewsletterApi(token, id);
            setNlModalOpen(false);
            await load();
          } catch (e) {
            Alert.alert('Send failed', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const removeNewsletter = (id: number) => {
    if (!token) return;
    Alert.alert('Delete draft', 'Delete this draft?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNewsletterApi(token, id);
            setNlModalOpen(false);
            await load();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  if (!user || !isStaffRole(user.role)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.muted}>You do not have access to this screen.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Newsletters / Promos</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Promo codes</Text>
            <Pressable style={styles.primaryOutline} onPress={openNewPromo}>
              <Text style={styles.primaryOutlineText}>+ Add promo</Text>
            </Pressable>
            {promos.length === 0 ? (
              <Text style={styles.muted}>No promo codes yet.</Text>
            ) : (
              promos.map((p) => {
                const st = p.service_type_id != null ? serviceTypes.find((s) => s.id === p.service_type_id) : null;
                return (
                <View key={p.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {p.code}
                    {p.is_active ? '' : ' (inactive)'}
                  </Text>
                  <Text style={styles.cardSub}>
                    {p.discount_type === 'percentage' ? `${p.discount_value}%` : `$${p.discount_value}`} off · used{' '}
                    {p.current_usage_count}
                    {p.usage_limit != null ? ` / ${p.usage_limit}` : ''}
                  </Text>
                  {p.service_type_id != null ? (
                    <Text style={styles.cardMeta}>
                      Service: {st ? serviceLabel(st) : `#${p.service_type_id}`}
                    </Text>
                  ) : (
                    <Text style={styles.cardMeta}>Any service</Text>
                  )}
                  <View style={styles.cardRow}>
                    <Pressable style={styles.smallBtn} onPress={() => openEditPromo(p)}>
                      <Text style={styles.smallBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.smallBtnDanger} onPress={() => removePromo(p.id)}>
                      <Text style={styles.smallBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
                );
              })
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Newsletters</Text>
            <Pressable style={styles.primaryOutline} onPress={openNewNewsletter}>
              <Text style={styles.primaryOutlineText}>+ New newsletter</Text>
            </Pressable>
            {newsletters.length === 0 ? (
              <Text style={styles.muted}>No newsletters yet.</Text>
            ) : (
              newsletters.map((n) => (
                <View key={n.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{n.subject}</Text>
                  <Text style={styles.cardSub}>
                    {n.sent_at ? `Sent ${String(n.sent_at).slice(0, 10)}` : 'Draft'}
                    {n.promo_code ? ` · Promo: ${n.promo_code}` : ''}
                  </Text>
                  {!n.sent_at ? (
                    <View style={styles.cardRow}>
                      <Pressable style={styles.smallBtn} onPress={() => openEditNewsletter(n)}>
                        <Text style={styles.smallBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.smallBtn} onPress={() => sendNewsletter(n.id)}>
                        <Text style={styles.smallBtnText}>Send</Text>
                      </Pressable>
                      <Pressable style={styles.smallBtnDanger} onPress={() => removeNewsletter(n.id)}>
                        <Text style={styles.smallBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={promoModalOpen} animationType="slide" transparent onRequestClose={() => setPromoModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{promoEditingId == null ? 'New promo' : 'Edit promo'}</Text>
            {promoEditingId == null ? (
              <>
                <Text style={styles.label}>Code</Text>
                <TextInput
                  style={styles.input}
                  value={pcCode}
                  onChangeText={setPcCode}
                  autoCapitalize="characters"
                  placeholderTextColor={NavbarColors.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Code</Text>
                <Text style={styles.readonlyCode}>{pcCode}</Text>
              </>
            )}
            <Text style={styles.label}>Discount</Text>
            <View style={styles.segmentRow}>
              <Pressable
                style={[styles.segment, pcDiscMode === 'percent' && styles.segmentActive]}
                onPress={() => setPcDiscMode('percent')}>
                <Text style={styles.segmentText}>Percent</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, pcDiscMode === 'dollar' && styles.segmentActive]}
                onPress={() => setPcDiscMode('dollar')}>
                <Text style={styles.segmentText}>Dollar amount</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>{pcDiscMode === 'percent' ? 'Percent off' : 'Amount ($)'}</Text>
            <TextInput
              style={styles.input}
              value={pcDiscVal}
              onChangeText={setPcDiscVal}
              keyboardType="decimal-pad"
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Min purchase ($)</Text>
            <TextInput
              style={styles.input}
              value={pcMin}
              onChangeText={setPcMin}
              keyboardType="decimal-pad"
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Expiration (YYYY-MM-DD, optional)</Text>
            <TextInput
              style={styles.input}
              value={pcExp}
              onChangeText={setPcExp}
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Usage limit (empty = unlimited)</Text>
            <TextInput
              style={styles.input}
              value={pcUsageLimit}
              onChangeText={setPcUsageLimit}
              keyboardType="number-pad"
              placeholderTextColor={NavbarColors.textMuted}
            />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Active</Text>
              <Switch value={pcActive} onValueChange={setPcActive} />
            </View>
            <Text style={styles.label}>Applies to service</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              <Pressable
                style={[styles.chip, pcServiceId === null && styles.chipActive]}
                onPress={() => setPcServiceId(null)}>
                <Text style={styles.chipText}>Any</Text>
              </Pressable>
              {serviceTypes.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.chip, pcServiceId === s.id && styles.chipActive]}
                  onPress={() => setPcServiceId(s.id)}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {serviceLabel(s)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalSecondary} onPress={() => setPromoModalOpen(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={savePromo}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={nlModalOpen} animationType="slide" transparent onRequestClose={() => setNlModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={{ maxHeight: '92%' }}
            contentContainerStyle={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{nlEditingId == null ? 'New newsletter' : 'Edit newsletter'}</Text>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={nlSubject}
              onChangeText={setNlSubject}
              placeholderTextColor={NavbarColors.textMuted}
            />
            <Text style={styles.label}>Linked promo (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              <Pressable
                style={[styles.chip, nlPromoId === null && styles.chipActive]}
                onPress={() => setNlPromoId(null)}>
                <Text style={styles.chipText}>None</Text>
              </Pressable>
              {promos.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, nlPromoId === p.id && styles.chipActive]}
                  onPress={() => setNlPromoId(p.id)}>
                  <Text style={styles.chipText}>{p.code}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.insertBtn} onPress={insertPromoIntoContent}>
              <Text style={styles.insertBtnText}>Insert code into message</Text>
            </Pressable>
            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={nlContent}
              onChangeText={setNlContent}
              multiline
              placeholderTextColor={NavbarColors.textMuted}
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalSecondary} onPress={() => setNlModalOpen(false)}>
                <Text style={styles.modalSecondaryText}>Close</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={saveNewsletter}>
                <Text style={styles.modalPrimaryText}>Save draft</Text>
              </Pressable>
            </View>
            {nlEditingId != null ? (
              <View style={styles.modalRow}>
                <Pressable style={styles.modalSecondary} onPress={() => sendNewsletter(nlEditingId)}>
                  <Text style={styles.modalSecondaryText}>Mark sent</Text>
                </Pressable>
                <Pressable style={styles.smallBtnDanger} onPress={() => removeNewsletter(nlEditingId)}>
                  <Text style={styles.smallBtnText}>Delete draft</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
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
  readonlyCode: {
    marginTop: 4,
    color: NavbarColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  multiline: {
    minHeight: 120,
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
    fontSize: 13,
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
  insertBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(194,24,91,0.45)',
    alignItems: 'center',
  },
  insertBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
