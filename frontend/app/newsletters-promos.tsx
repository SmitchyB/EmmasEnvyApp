import { useRouter } from 'expo-router'; // Import the useRouter hook from expo-router
import React, { useCallback, useEffect, useState } from 'react';
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
import {
  createNewsletterApi, // Import the createNewsletterApi function from @/lib/newsletters-promos-api
  createPromoCodeApi, // Import the createPromoCodeApi function from @/lib/newsletters-promos-api
  deleteNewsletterApi, // Import the deleteNewsletterApi function from @/lib/newsletters-promos-api
  deletePromoCodeApi, // Import the deletePromoCodeApi function from @/lib/newsletters-promos-api
  listNewslettersApi, // Import the listNewslettersApi function from @/lib/newsletters-promos-api
  listPromoCodes, // Import the listPromoCodes function from @/lib/newsletters-promos-api
  patchNewsletterApi, // Import the patchNewsletterApi function from @/lib/newsletters-promos-api
  patchPromoCodeApi, // Import the patchPromoCodeApi function from @/lib/newsletters-promos-api
  sendNewsletterApi, // Import the sendNewsletterApi function from @/lib/newsletters-promos-api
  serviceLabel, // Import the serviceLabel function from @/lib/newsletters-promos-api
  type NewsletterDto, // Import the NewsletterDto type from @/lib/newsletters-promos-api
  type PromoCodeDto, // Import the PromoCodeDto type from @/lib/newsletters-promos-api
} from '@/lib/newsletters-promos-api';
import { isStaffRole } from '@/lib/roles'; // Import the isStaffRole function from @/lib/roles

/* This file is the frontend screen for the newsletters and promos. It is used to create, update, and delete newsletters and promos. */ 

// Export the NewslettersPromosScreen component
export default function NewslettersPromosScreen() {
  //All the state variables
  const insets = useSafeAreaInsets(); // Import the useSafeAreaInsets hook from react-native-safe-area-context
  const router = useRouter(); // Import the useRouter hook from expo-router
  const { user, token } = useAuth(); // Import the useAuth hook from @/contexts/AuthContext
  const [promos, setPromos] = useState<PromoCodeDto[]>([]); // Import the PromoCodeDto type from @/lib/newsletters-promos-api
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]); // Import the NewsletterDto type from @/lib/newsletters-promos-api
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]); // Import the ServiceType type from @/lib/booking-types
  const [loading, setLoading] = useState(true); // Import the useState hook from react
  const [promoModalOpen, setPromoModalOpen] = useState(false); // Import the useState hook from react
  const [promoEditingId, setPromoEditingId] = useState<number | null>(null); // Import the useState hook from react
  const [pcCode, setPcCode] = useState(''); // Import the useState hook from react
  const [pcDiscMode, setPcDiscMode] = useState<'percent' | 'dollar'>('percent'); // Import the useState hook from react
  const [pcDiscVal, setPcDiscVal] = useState(''); // Import the useState hook from react
  const [pcMin, setPcMin] = useState('0'); // Import the useState hook from react
  const [pcExp, setPcExp] = useState(''); // Import the useState hook from react
  const [pcUsageLimit, setPcUsageLimit] = useState(''); // Import the useState hook from react
  const [pcActive, setPcActive] = useState(true); // Import the useState hook from react
  const [pcServiceId, setPcServiceId] = useState<number | null>(null); // Import the useState hook from react
  const [nlModalOpen, setNlModalOpen] = useState(false); // Import the useState hook from react
  const [nlEditingId, setNlEditingId] = useState<number | null>(null); // Import the useState hook from react
  const [nlSubject, setNlSubject] = useState(''); // Import the useState hook from react
  const [nlContent, setNlContent] = useState(''); // Import the useState hook from react
  const [nlPromoId, setNlPromoId] = useState<number | null>(null); // Import the useState hook from react

  // Load the promo codes and newsletters
  const load = useCallback(async () => {
    if (!token) return; // If the token is not found, return
    setLoading(true); // Set the loading state to true
    // Try to load the promo codes and newsletters
    try {
      // Load the promo codes, newsletters, and service types
      const [pl, nl, st] = await Promise.all([
        listPromoCodes(token), // Load the promo codes
        listNewslettersApi(token), // Load the newsletters
        fetchPublicServiceTypes(), // Load the service types
      ]);
      setPromos(pl); // Set the promo codes
      setNewsletters(nl); // Set the newsletters
      setServiceTypes(st); // Set the service types
    } catch {
      setPromos([]); // Set the promo codes to an empty array
      setNewsletters([]); // Set the newsletters to an empty array
    } finally {
      setLoading(false); // Set the loading state to false
    }
  }, [token]); // Load the promo codes and newsletters

  // Load the promo codes and newsletters
  useEffect(() => {
    load(); // Load the promo codes and newsletters
  }, [load]);

  // Open the new promo modal
  const openNewPromo = () => {
    setPromoEditingId(null); // Set the promo editing id to null
    setPcCode(''); // Set the promo code to an empty string
    setPcDiscMode('percent'); // Set the promo discount mode to percent
    setPcDiscVal(''); // Set the promo discount value to an empty string
    setPcMin('0'); // Set the promo minimum to 0
    setPcExp(''); // Set the promo expiration date to an empty string
    setPcUsageLimit(''); // Set the promo usage limit to an empty string
    setPcActive(true); // Set the promo active to true
    setPcServiceId(null); // Set the promo service id to null
    setPromoModalOpen(true); // Set the promo modal open to true
  };

  // Open the edit promo modal
  const openEditPromo = (p: PromoCodeDto) => {
    setPromoEditingId(p.id); // Set the promo editing id to the promo id
    setPcCode(p.code); // Set the promo code to the promo code
    setPcDiscMode(p.discount_type === 'flat_amount' ? 'dollar' : 'percent'); // Set the promo discount mode to the promo discount mode
    setPcDiscVal(String(p.discount_value)); // Set the promo discount value to the promo discount value
    setPcMin(String(p.min_purchase_amount ?? 0)); // Set the promo minimum to the promo minimum
    setPcExp(p.expiration_date ? String(p.expiration_date).slice(0, 10) : ''); // Set the promo expiration date to the promo expiration date
    setPcUsageLimit(p.usage_limit != null ? String(p.usage_limit) : ''); // Set the promo usage limit to the promo usage limit
    setPcActive(p.is_active); // Set the promo active to the promo active
    setPcServiceId(p.service_type_id); // Set the promo service id to the promo service id
    setPromoModalOpen(true); // Set the promo modal open to true
  };

  // Save the promo
  const savePromo = async () => {
    if (!token) return; // If the token is not found, return
    const val = parseFloat(pcDiscVal); // Get the promo discount value from the promo discount value
    // If the promo discount value is not a number or is less than 0, return a 400 error
    if (Number.isNaN(val) || val <= 0) {
      Alert.alert('Enter a positive discount value'); // If the promo discount value is not a number or is less than 0, return a 400 error
      return;
    }
    const minPurchase = parseFloat(pcMin); // Get the promo minimum from the promo minimum
    // If the promo minimum is not a number or is less than 0, return a 400 error
    if (Number.isNaN(minPurchase) || minPurchase < 0) {
      Alert.alert('Min purchase must be 0 or greater'); // If the promo minimum is not a number or is less than 0, return a 400 error
      return;
    }
    const usageLimit = pcUsageLimit.trim() === '' ? null : parseInt(pcUsageLimit, 10); // Get the promo usage limit from the promo usage limit
    // If the promo usage limit is not a number or is less than 0, return a 400 error
    if (pcUsageLimit.trim() !== '' && (Number.isNaN(usageLimit!) || usageLimit! < 0)) {
      Alert.alert('Usage limit must be empty or a non-negative integer'); // If the promo usage limit is not a number or is less than 0, return a 400 error
      return;
    }
    const exp = pcExp.trim() === '' ? null : pcExp.trim(); // Get the promo expiration date from the promo expiration date
    const dt = pcDiscMode === 'percent' ? 'percent' : 'fixed'; // Get the promo discount type from the promo discount type
    // Try to save the promo
    try {
      // If the promo editing id is null, create a new promo
      if (promoEditingId == null) {
        const c = pcCode.trim(); // Get the promo code from the promo code
        // If the promo code is not found, return a 400 error
        if (!c) {
          Alert.alert('Code is required'); // Show an alert that the code is required
          return; // Return
        }
        // Create a new promo
        await createPromoCodeApi(token, {
          code: c, // Set the promo code to the promo code
          discount_type: dt, // Set the promo discount type to the promo discount type
          discount_value: val, // Set the promo discount value to the promo discount value
          min_purchase_amount: minPurchase, // Set the promo minimum to the promo minimum
          expiration_date: exp, // Set the promo expiration date to the promo expiration date
          usage_limit: usageLimit, // Set the promo usage limit to the promo usage limit
          is_active: pcActive, // Set the promo active to the promo active
          service_type_id: pcServiceId, // Set the promo service id to the promo service id
        });
      } 
      // else update the promo
      else {
        //await to patch the promo
        await patchPromoCodeApi(token, promoEditingId, {
          discount_type: dt, // Set the promo discount type to the promo discount type
          discount_value: val, // Set the promo discount value to the promo discount value
          min_purchase_amount: minPurchase, // Set the promo minimum to the promo minimum
          expiration_date: exp, // Set the promo expiration date to the promo expiration date
          usage_limit: usageLimit, // Set the promo usage limit to the promo usage limit
          is_active: pcActive, // Set the promo active to the promo active
          service_type_id: pcServiceId, // Set the promo service id to the promo service id
        });
      }
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.'); // Show an alert that the save failed
    }
  };

  // Remove the promo
  const removePromo = (id: number) => {
    if (!token) return; // If the token is not found, return
    // Show an alert that the delete promo
    Alert.alert('Delete promo', 'Remove this promo code?', [
      { text: 'Cancel', style: 'cancel' }, // Show an alert that the cancel is clicked
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deletePromoCodeApi(token, id); await load(); } catch (e) { Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'); } }, }, // Show an alert that the delete is clicked
      ]);
    };
  // Open the new newsletter modal
  const openNewNewsletter = () => {
    setNlEditingId(null); // Set the newsletter editing id to null
    setNlSubject(''); // Set the newsletter subject to an empty string
    setNlContent(''); // Set the newsletter content to an empty string
    setNlPromoId(null); // Set the newsletter promo id to null
    setNlModalOpen(true); // Set the newsletter modal open to true
  };

  // Open the edit newsletter modal
  const openEditNewsletter = (n: NewsletterDto) => {
    if (n.sent_at) { // If the newsletter is sent, return
      Alert.alert('Read only', 'Sent newsletters cannot be edited.'); // Show an alert that the newsletter is sent
      return; // Return
    }
    setNlEditingId(n.id); // Set the newsletter editing id to the newsletter id
    setNlSubject(n.subject); // Set the newsletter subject to the newsletter subject
    setNlContent(n.content ?? ''); // Set the newsletter content to the newsletter content
    setNlPromoId(n.promo_code_id); // Set the newsletter promo id to the newsletter promo id
    setNlModalOpen(true); // Set the newsletter modal open to true
  };

  // Insert the promo into the content
  const insertPromoIntoContent = () => {
    const pid = nlPromoId; // Get the newsletter promo id from the newsletter promo id
    // If the newsletter promo id is null, return
    if (pid == null) {
      Alert.alert('Select a promo', 'Choose a promo code in the newsletter form first.'); // Show an alert that the select a promo is clicked
      return; // Return
    }
    const p = promos.find((x) => x.id === pid); // Get the promo from the promo id
    // If the promo is not found, return
    if (!p) {
      Alert.alert('Promo not found', 'Reload and try again.'); // Show an alert that the promo is not found
      return; // Return
    }
    const line = `\n\nUse code: ${p.code}\n`; // Get the line from the promo code
    setNlContent((c) => (c.endsWith('\n') || c === '' ? `${c}${line.trimStart()}` : `${c}${line}`)); // Set the newsletter content to the newsletter content
  };

  // Save the newsletter
  const saveNewsletter = async () => {
    if (!token) return; // If the token is not found, return
    const subj = nlSubject.trim(); // Get the newsletter subject from the newsletter subject
    // If the newsletter subject is not found, return
    if (!subj) {
      Alert.alert('Subject is required'); // Show an alert that the subject is required
      return; // Return
    }
    // Try to save the newsletter
    try {
      // If the newsletter editing id is null, create a new newsletter
      if (nlEditingId == null) {
        // Create a new newsletter
        await createNewsletterApi(token, {
          subject: subj, // Set the newsletter subject to the newsletter subject
          content: nlContent, // Set the newsletter content to the newsletter content
          promo_code_id: nlPromoId, // Set the newsletter promo id to the newsletter promo id
        });
      } 
      // else update the newsletter
      else {
        //await to patch the newsletter
        await patchNewsletterApi(token, nlEditingId, {
          subject: subj, // Set the newsletter subject to the newsletter subject
          content: nlContent, // Set the newsletter content to the newsletter content
          promo_code_id: nlPromoId, // Set the newsletter promo id to the newsletter promo id
        });
      }
      setNlModalOpen(false); // Set the newsletter modal open to false
      await load(); // Load the promo codes and newsletters
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.'); // Show an alert that the save failed
    }
  };
  // Send the newsletter
  const sendNewsletter = (id: number) => {
    if (!token) return; // If the token is not found, return
    // Show an alert that the send newsletter
    Alert.alert('Send newsletter', 'Mark this newsletter as sent?', [
      { text: 'Cancel', style: 'cancel' }, // Show an alert that the cancel is clicked
      { text: 'Send', style: 'destructive', onPress: async () => { try { await sendNewsletterApi(token, id); setNlModalOpen(false); await load(); } catch (e) { Alert.alert('Send failed', e instanceof Error ? e.message : 'Try again.'); } }, }, // Show an alert that the send is clicked
    ]);
  };

  // Remove the newsletter
  const removeNewsletter = (id: number) => {
    if (!token) return; // If the token is not found, return
    // Show an alert that the delete newsletter
    Alert.alert('Delete draft', 'Delete this draft?', [
      { text: 'Cancel', style: 'cancel' }, // Show an alert that the cancel is clicked
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteNewsletterApi(token, id); setNlModalOpen(false); await load(); } catch (e) { Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'); } }, }, // Show an alert that the delete is clicked
    ]);
  };
  // If the user is not a staff role, return
  if (!user || !isStaffRole(user.role)) {
    // Return the user does not have access to this screen
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.muted}>You do not have access to this screen.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  // Return the newsletters and promos screen
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
