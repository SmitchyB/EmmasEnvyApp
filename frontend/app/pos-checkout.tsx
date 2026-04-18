// This file is used to handle the POS checkout process for the frontend
import { useLocalSearchParams, useRouter } from 'expo-router'; //Import the useLocalSearchParams and useRouter from expo-router for the router
import React, { useCallback, useEffect, useRef, useState } from 'react'; //Import the React, useCallback, useEffect, useRef, and useState from react for the state
import {
  ActivityIndicator, //Import the ActivityIndicator from react-native for the activity indicator
  BackHandler, //Import the BackHandler from react-native for the back handler
  KeyboardAvoidingView, //Import the KeyboardAvoidingView from react-native for the keyboard avoiding view
  Platform, //Import the Platform from react-native for the platform
  Pressable, //Import the Pressable from react-native for the pressable
  ScrollView, //Import the ScrollView from react-native for the scroll view
  StyleSheet, //Import the StyleSheet from react-native for the style sheet
  Text, //Import the Text from react-native for the text
  TextInput, //Import the TextInput from react-native for the text input
  View, //Import the View from react-native for the view
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; //Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { SquareCardTokenModal } from '@/components/pos/SquareCardTokenModal'; //Import the SquareCardTokenModal from the components/pos/SquareCardTokenModal for the square card token modal
import { NavbarColors } from '@/constants/theme'; //Import the NavbarColors from the constants/theme for the navbar colors
import { SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID } from '@/constants/config'; //Import the SQUARE_APPLICATION_ID and SQUARE_LOCATION_ID from the constants/config for the square application id and square location id
import { useAuth } from '@/contexts/AuthContext'; //Import the useAuth from the contexts/AuthContext for the auth
import { useBookingData } from '@/contexts/BookingDataContext'; //Import the useBookingData from the contexts/BookingDataContext for the booking data
import { getAppointment } from '@/lib/booking-api'; //Import the getAppointment from the lib/booking-api for the get appointment
import type { Appointment } from '@/lib/booking-types'; //Import the Appointment from the lib/booking-types for the appointment
import {
  getCustomerEligibleRewards, //Import the getCustomerEligibleRewards from the lib/pos-api for the get customer eligible rewards
  posChargeCardApi, //Import the posChargeCardApi from the lib/pos-api for the pos charge card api
  posPreview, //Import the posPreview from the lib/pos-api for the pos preview
  posRecordCashPayment, //Import the posRecordCashPayment from the lib/pos-api for the pos record cash payment
  type PosPaymentSuccess, //Import the PosPaymentSuccess from the lib/pos-api for the pos payment success
  type PosPreviewResponse, //Import the PosPreviewResponse from the lib/pos-api for the pos preview response
} from '@/lib/pos-api';
import { listAvailableRewardOfferings, type RewardOfferingDto } from '@/lib/rewards-api'; //Import the listAvailableRewardOfferings and type RewardOfferingDto from the lib/rewards-api for the list available reward offerings and reward offering dto
import { isStaffRole } from '@/lib/roles'; //Import the isStaffRole from the lib/roles for the is staff role

type Step = 'totals' | 'method' | 'cash' | 'card' | 'done'; //Import the Step from the lib/pos-checkout for the step

// Function to get the error message
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message; //If the error is an instance of Error, then return the error message
  if (typeof e === 'string') return e; //If the error is a string, then return the error
  return 'Something went wrong. Please try again.';
}

// Function to parse the tip
function parseTip(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '.')); //Parse the tip
  return Number.isNaN(n) || n < 0 ? 0 : n; //If the n is not a number or is less than 0, then return 0
}

// Function to parse the cash
function parseCash(s: string): number | null {
  const n = parseFloat(String(s).replace(/,/g, '.')); //Parse the cash
  return Number.isNaN(n) ? null : n; //If the n is not a number, then return null
}

// Function to format the money
function formatMoney(n: number): string {
  return n.toFixed(2); //Return the money formatted to 2 decimal places
}

const TIP_PRESETS_PCT = [15, 18, 20] as const; //Set the TIP_PRESETS_PCT to the tip presets percentage
const PREVIEW_DEBOUNCE_MS = 320; //Set the PREVIEW_DEBOUNCE_MS to the preview debounce milliseconds

// Set the colors for the POS checkout screen
const C = {
  cardBg: 'rgba(22,12,18,0.92)', 
  border: NavbarColors.border,
  pink: 'rgba(194,24,91,0.92)',
  pinkSoft: 'rgba(233,30,99,0.35)',
  errorBg: 'rgba(180,40,60,0.2)',
  errorBorder: 'rgba(255,120,140,0.45)',
  warnBg: 'rgba(200,150,40,0.15)',
};

// Function to export the POS checkout screen
export default function PosCheckoutScreen() {
  //All the states for the POS checkout screen
  const insets = useSafeAreaInsets(); //Set the insets to the safe area insets
  const router = useRouter(); //Set the router to the router
  const { user, token } = useAuth(); //Set the user and token to the user and token
  const { refreshAppointments } = useBookingData(); //Set the refreshAppointments to the refresh appointments
  const { appointmentId: appointmentIdParam } = useLocalSearchParams<{ appointmentId?: string }>(); //Set the appointmentId to the appointment id
  const [step, setStep] = useState<Step>('totals'); //Set the step to the totals
  const [appointment, setAppointment] = useState<Appointment | null>(null); //Set the appointment to the appointment
  const [loadErr, setLoadErr] = useState<string | null>(null); //Set the loadErr to the load error
  const [fetchingAppt, setFetchingAppt] = useState(true); //Set the fetchingAppt to the fetching appointment
  const [busy, setBusy] = useState(false); //Set the busy to the busy
  const [preview, setPreview] = useState<PosPreviewResponse | null>(null); //Set the preview to the preview
  const [tipStr, setTipStr] = useState('0'); //Set the tipStr to the tip
  const [promoStr, setPromoStr] = useState(''); //Set the promoStr to the promo
  const [rewardId, setRewardId] = useState<number | null>(null); //Set the rewardId to the reward id
  const [redeemOfferings, setRedeemOfferings] = useState<RewardOfferingDto[]>([]); //Set the redeemOfferings to the redeem offerings
  const [catalogOfferings, setCatalogOfferings] = useState<RewardOfferingDto[]>([]); //Set the catalogOfferings to the catalog offerings
  const [clientPointsBalance, setClientPointsBalance] = useState<number | null>(null); //Set the clientPointsBalance to the client points balance
  const [cashStr, setCashStr] = useState(''); //Set the cashStr to the cash
  const [previewError, setPreviewError] = useState<string | null>(null); //Set the previewError to the preview error
  const [promoFieldError, setPromoFieldError] = useState<string | null>(null); //Set the promoFieldError to the promo field error
  const [rewardsWarning, setRewardsWarning] = useState<string | null>(null); //Set the rewardsWarning to the rewards warning
  const [payError, setPayError] = useState<string | null>(null); //Set the payError to the pay error
  const [cashFieldError, setCashFieldError] = useState<string | null>(null); //Set the cashFieldError to the cash field error
  const [lastPayment, setLastPayment] = useState<PosPaymentSuccess | null>(null); //Set the lastPayment to the last payment
  const [squareModalVisible, setSquareModalVisible] = useState(false); //Set the squareModalVisible to the square modal visible
  const [squareModalKey, setSquareModalKey] = useState(0); //Set the squareModalKey to the square modal key
  const tipStrRef = useRef(tipStr); //Set the tipStrRef to the tipStr
  const promoStrRef = useRef(promoStr); //Set the promoStrRef to the promoStr
  const rewardIdRef = useRef(rewardId); //Set the rewardIdRef to the rewardId
  tipStrRef.current = tipStr; //Set the tipStrRef to the tipStr
  promoStrRef.current = promoStr; //Set the promoStrRef to the promoStr
  rewardIdRef.current = rewardId; //Set the rewardIdRef to the rewardId
  const lastPreviewApptId = useRef<number | null>(null); //Set the lastPreviewApptId to the last preview appointment id
  const staff = isStaffRole(user?.role); //Set the staff to the staff
  const appointmentId = appointmentIdParam ? parseInt(String(appointmentIdParam), 10) : NaN; //Set the appointmentId to the appointment id
  const customerId = appointment?.client_id ?? null; //Set the customerId to the customer id
  const serviceTypeId = appointment?.service_type_id ?? 0; //Set the serviceTypeId to the service type id
  
  //Callback function to refresh the preview
  const refreshPreview = useCallback(
    async (opts?: { advanceToMethod?: boolean }) => {
      if (!appointment || !token) return; //If the appointment or token is not set, then return
      setBusy(true); //Set the busy to true
      setPreviewError(null); //Set the previewError to null
      setPromoFieldError(null); //Set the promoFieldError to null
      setRewardsWarning(null); //Set the rewardsWarning to null
      setPayError(null); //Set the payError to null
      const hadPromoInRequest = promoStrRef.current.trim().length > 0; //Set the hadPromoInRequest to the had promo in request
      //Try to refresh the preview
      try {
        const tip = parseTip(tipStrRef.current); //Set the tip to the tip
        //Set the body to the body
        const body: Parameters<typeof posPreview>[1] = {
          appointmentId: appointment.id,
          tip,
        };
        const p = promoStrRef.current.trim(); //Set the p to the p from the promoStrRef
        if (p) body.promoCode = p; //If the p is set, then set the promoCode to the p
        if (rewardIdRef.current != null) body.reward_offering_id = rewardIdRef.current; //If the rewardIdRef is set, then set the reward_offering_id to the rewardIdRef

        const pr = await posPreview(token, body); //Set the pr to the pr from the posPreview
        setPreview(pr); //Set the preview to the pr
        setPromoFieldError(null); //Set the promoFieldError to null

        //If the customerId and serviceTypeId are set, then try to get the customer eligible rewards
        if (customerId != null && serviceTypeId) {
          //Try to get the customer eligible rewards
          try {
            //Set the el to the el from the getCustomerEligibleRewards
            const el = await getCustomerEligibleRewards(token, {
              customerId, //Set the customerId to the customerId
              subtotal: pr.service_subtotal, //Set the subtotal to the subtotal from the pr
              service_type_id: serviceTypeId, //Set the service_type_id to the serviceTypeId
            });
            setRedeemOfferings(el.reward_offerings); //Set the redeemOfferings to the el.reward_offerings
            setClientPointsBalance(el.points); //Set the clientPointsBalance to the el.points
            setRewardsWarning(null); //Set the rewardsWarning to null

            //Try to get the catalog offerings
            try {
              //Set the catalog to the catalog from the listAvailableRewardOfferings
              const catalog = await listAvailableRewardOfferings({
                subtotal: pr.service_subtotal, //Set the subtotal to the subtotal from the pr
                service_type_id: serviceTypeId, //Set the service_type_id to the serviceTypeId
              });
              setCatalogOfferings(catalog); //Set the catalogOfferings to the catalog
            } catch {
              setCatalogOfferings([]); //Set the catalogOfferings to an empty array
            }
          } catch (e) {
            setRedeemOfferings([]); //Set the redeemOfferings to an empty array
            setCatalogOfferings([]); //Set the catalogOfferings to an empty array
            setClientPointsBalance(null); //Set the clientPointsBalance to null
            setRewardsWarning(errMsg(e)); //Set the rewardsWarning to the error message
          }
        } 
        // Else set the redeemOfferings, catalogOfferings, and clientPointsBalance to an empty array and null
        else {
          setRedeemOfferings([]); //Set the redeemOfferings to an empty array
          setCatalogOfferings([]); //Set the catalogOfferings to an empty array
          setClientPointsBalance(null); //Set the clientPointsBalance to null
        }
        if (opts?.advanceToMethod) setStep('method'); //If the opts.advanceToMethod is set, then set the step to the method
      } catch (e) {
        setPreview(null); //Set the preview to null
        const msg = errMsg(e); //Set the msg to the error message
        //If the hadPromoInRequest is set, then set the promoFieldError to the msg and set the previewError to null
        if (hadPromoInRequest) {
          setPromoFieldError(msg); //Set the promoFieldError to the msg
          setPreviewError(null); //Set the previewError to null
        } 
        // Else set the previewError to the msg and set the promoFieldError to null
        else {
          setPreviewError(msg); //Set the previewError to the msg
          setPromoFieldError(null); //Set the promoFieldError to null
        }
      } 
      // Finally set the busy to false
      finally {
        setBusy(false); //Set the busy to false
      }
    },
    [appointment, token, customerId, serviceTypeId] //Dependencies for the refreshPreview callback function
  );

  const refreshPreviewRef = useRef(refreshPreview); //Set the refreshPreviewRef to the refreshPreview
  refreshPreviewRef.current = refreshPreview; //Set the refreshPreviewRef to the refreshPreview

  //useEffect to refresh the preview when the appointment loads or the tip, promo, or reward changes
  useEffect(() => {
    if (!appointment || !token) return; //If the appointment or token is not set, then return
    const apptId = appointment.id; //Set the apptId to the appointment id
    const isFirstForAppt = lastPreviewApptId.current !== apptId; //Set the isFirstForAppt to the is first for appointment
    //If the isFirstForAppt is true, then set the lastPreviewApptId to the apptId and refresh the preview
    if (isFirstForAppt) {
      lastPreviewApptId.current = apptId; //Set the lastPreviewApptId to the apptId
      void refreshPreviewRef.current(); //Void the refreshPreviewRef
      return;
    }
    const id = setTimeout(() => void refreshPreviewRef.current(), PREVIEW_DEBOUNCE_MS); //Set the id to the setTimeout
    return () => clearTimeout(id); //Return a function to clear the timeout
  }, [appointment, token, tipStr, promoStr, rewardId]); //Dependencies for the useEffect

  //useEffect to refresh the preview when the staff or token changes
  useEffect(() => {
    //If the staff or token is not set, then back the router
    if (!staff || !token) {
      router.back(); //Back the router
      return; //Return
    }
    //If the appointmentId is not a number or is less than 1, then set the loadErr to 'Missing or invalid appointment.' and set the fetchingAppt to false
    if (!Number.isFinite(appointmentId) || appointmentId < 1) {
      setLoadErr('Missing or invalid appointment.'); //Set the loadErr to 'Missing or invalid appointment.'
      setFetchingAppt(false); //Set the fetchingAppt to false
      return;
    }
    let cancelled = false; //Set the cancelled to false
    //Try to get the appointment
    (async () => {
      try {
        const a = await getAppointment(token, appointmentId); //Set the a to the a from the getAppointment
        if (cancelled) return; //If the cancelled is true, then return
        setAppointment(a); //Set the appointment to the a
        setLoadErr(null); //Set the loadErr to null
      } catch (e) {
        if (!cancelled) setLoadErr(errMsg(e)); //If the cancelled is false, then set the loadErr to the error message
      } finally {
        if (!cancelled) setFetchingAppt(false); //If the cancelled is false, then set the fetchingAppt to false
      }
    })();
    //Return a function to set the cancelled to true
    return () => {
      cancelled = true; //Set the cancelled to true
    };
  }, [staff, token, appointmentId, router]); //Dependencies for the useEffect

  //useEffect to handle the hardware back press
  useEffect(() => {
    //If the squareModalVisible is true, then set the squareModalVisible to false and return true
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      //If the squareModalVisible is true, then set the squareModalVisible to false and return true
      if (squareModalVisible) {
        setSquareModalVisible(false); //Set the squareModalVisible to false
        return true; //Return true
      }
      //If the step is done, then back the router and return true
      if (step === 'done') {
        router.back(); //Back the router
        return true; //Return true
      }
      //If the step is cash or card, then set the step to the method and set the payError to null and return true
      if (step === 'cash' || step === 'card') {
        setStep('method'); //Set the step to the method
        setPayError(null); //Set the payError to null
        return true; //Return true
      }
      //If the step is method, then set the step to the totals and return true
      if (step === 'method') {
        setStep('totals'); //Set the step to the totals
        return true; //Return true
      }
      return false; //Return false
    });
    return () => sub.remove(); //Return a function to remove the subscription
  }, [step, router, squareModalVisible]); //Dependencies for the useEffect

  const baseBeforeTip = preview && preview.pre_tip_total > 0 ? preview.pre_tip_total : null; //Set the baseBeforeTip to the base before tip

  //Function to apply the tip percentage
  const applyTipPercent = (pct: number) => {
    if (baseBeforeTip == null) return; //If the baseBeforeTip is null, then return
    const dollars = Math.round(baseBeforeTip * (pct / 100) * 100) / 100; //Set the dollars to the dollars from the baseBeforeTip and the pct
    const s = formatMoney(dollars); //Set the s to the s from the dollars
    setTipStr(s); //Set the tipStr to the s
    tipStrRef.current = s; //Set the tipStrRef to the s
  };

  //Function to continue to the payment
  const continueToPayment = () => {
    if (!appointment) return; //If the appointment is not set, then return
    void refreshPreview({ advanceToMethod: true }); //Void the refreshPreview
  };

  //Function to run the cash payment
  const runCash = async () => {
    if (!preview || !appointment || !token) return; //If the preview or appointment or token is not set, then return
    setPayError(null); //Set the payError to null
    setCashFieldError(null); //Set the cashFieldError to null
    const received = parseCash(cashStr); //Set the received to the received from the cashStr
    //If the received is null, then set the cashFieldError to 'Enter a valid number for cash received.' and return
    if (received == null) {
      setCashFieldError('Enter a valid number for cash received.'); //Set the cashFieldError to 'Enter a valid number for cash received.'
      return; //Return
    }
    //If the received is less than the grand total minus 0.005, then set the cashFieldError to 'Cash received must be at least $${formatMoney(preview.grand_total)}.' and return
    if (received < preview.grand_total - 0.005) {
      setCashFieldError(`Cash received must be at least $${formatMoney(preview.grand_total)}.`); //Set the cashFieldError to 'Cash received must be at least $${formatMoney(preview.grand_total)}.'
      return; //Return
    }
    setBusy(true); //Set the busy to true
    //Try to record the cash payment
    try {
      const tip = parseTip(tipStr); //Set the tip to the tip from the tipStr
      const body = {
        appointmentId: appointment.id, //Set the appointmentId to the appointment id
        paymentMethod: 'cash' as const, //Set the paymentMethod to the cash
        amountReceived: received, //Set the amountReceived to the received
        checkout_idempotency_key: preview.idempotency_key, //Set the checkout_idempotency_key to the preview.idempotency_key
        tip, //Set the tip to the tip
        ...(promoStr.trim() ? { promoCode: promoStr.trim() } : {}), //Set the promoCode to the promoStr if the promoStr is set
        ...(rewardId != null ? { reward_offering_id: rewardId } : {}), //Set the reward_offering_id to the rewardId if the rewardId is set
      };
      const result = await posRecordCashPayment(token, body); //Set the result to the result from the posRecordCashPayment
      setLastPayment(result); //Set the lastPayment to the result
      setStep('done'); //Set the step to the done
      await refreshAppointments(); //Void the refreshAppointments
    } catch (e) {
      setPayError(errMsg(e)); //Set the payError to the error message
    } finally {
      setBusy(false);
    }
  };

  //Function to open the square card modal
  const openSquareCardModal = () => {
    if (!preview || !appointment || !token) return; //If the preview or appointment or token is not set, then return
    //If the SQUARE_APPLICATION_ID or SQUARE_LOCATION_ID is not set, then set the payError to 'Add EXPO_PUBLIC_SQUARE_APPLICATION_ID and EXPO_PUBLIC_SQUARE_LOCATION_ID to frontend/.env, then restart Expo.' and return
    if (!SQUARE_APPLICATION_ID.trim() || !SQUARE_LOCATION_ID.trim()) {
      setPayError('Add EXPO_PUBLIC_SQUARE_APPLICATION_ID and EXPO_PUBLIC_SQUARE_LOCATION_ID to frontend/.env, then restart Expo.');
      return;
    }
    setPayError(null); //Set the payError to null
    setSquareModalKey((k) => k + 1); //Set the squareModalKey to the squareModalKey plus 1
    setSquareModalVisible(true); //Set the squareModalVisible to true
  };

  //Function to complete the card with nonce
  const completeCardWithNonce = async (squareCardNonce: string) => {
    if (!preview || !appointment || !token) return; //If the preview or appointment or token is not set, then return
    setSquareModalVisible(false); //Set the squareModalVisible to false
    setPayError(null); //Set the payError to null
    setBusy(true); //Set the busy to true
    //Try to complete the card with nonce
    try {
      const tip = parseTip(tipStr); //Set the tip to the tip from the tipStr
      //Set the restult to the result from the posChargeCardApi
      const result = await posChargeCardApi(token, {
        appointmentId: appointment.id, //Set the appointmentId to the appointment id
        checkout_idempotency_key: preview.idempotency_key, //Set the checkout_idempotency_key to the preview.idempotency_key
        square_card_nonce: squareCardNonce, //Set the square_card_nonce to the squareCardNonce
        tip, //Set the tip to the tip
        ...(promoStr.trim() ? { promoCode: promoStr.trim() } : {}), //Set the promoCode to the promoStr if the promoStr is set
        ...(rewardId != null ? { reward_offering_id: rewardId } : {}), //Set the reward_offering_id to the rewardId if the rewardId is set
      });
      setLastPayment(result); //Set the lastPayment to the result
      setStep('done'); //Set the step to the done
      await refreshAppointments(); //Void the refreshAppointments
    } catch (e) {
      setPayError(errMsg(e)); //Set the payError to the error message
    } finally {
      setBusy(false);
    }
  };

  //Function to go back
  const goBack = () => {
    //If the squareModalVisible is true, then set the squareModalVisible to false and return
    if (squareModalVisible) {
      setSquareModalVisible(false); //Set the squareModalVisible to false
      return; //Return
    }
    //If the step is done, then back the router and return
    if (step === 'done') {
      router.back(); //Back the router
    } 
    //Else if the step is cash or card, then set the step to the method and set the payError to null and return
    else if (step === 'cash' || step === 'card') {
      setStep('method'); //Set the step to the method
      setPayError(null); //Set the payError to null
    } 
    //Else if the step is method, then set the step to the totals and return
    else if (step === 'method') {
      setStep('totals'); //Set the step to the totals
    } 
    //Else back the router and return
    else {
      router.back(); //Back the router
    }
  };

  if (!staff) return null; //If the staff is not set, then return null

  //If the loadErr is set, then return the view with the loadErr
  if (loadErr) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.muted}>{loadErr}</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  //If the fetchingAppt or appointment is not set, then return the view with the loading indicator
  if (fetchingAppt || !appointment) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={NavbarColors.text} size="large" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  const serviceLabel = appointment.service_type_title?.trim() || 'Service'; //Set the serviceLabel to the service type title
  const stepLabel = step === 'totals' ? 'Tip & total' : step === 'method' ? 'Payment' : step === 'cash' ? 'Cash' : step === 'card' ? 'Card' : 'Done'; //Set the stepLabel to the step
  const pointsBalance = clientPointsBalance ?? preview?.customer_reward_points ?? null; //Set the pointsBalance to the client points balance or the preview customer reward points
  const needMorePointsOfferings = pointsBalance != null ? catalogOfferings.filter((o) => o.point_cost > pointsBalance) : []; //Set the needMorePointsOfferings to the catalog offerings filtered by the points balance
  const cashReceived = parseCash(cashStr); //Set the cashReceived to the cash from the cashStr
  const changePreview = preview && cashReceived != null && cashReceived >= preview.grand_total - 0.005 ? round2(cashReceived - preview.grand_total) : null; //Set the changePreview to the change from the cashReceived and the preview grand total

  //Return the view with the POS checkout screen
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}>
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={goBack} style={styles.backHit} hitSlop={12}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.stepPill}>{stepLabel}</Text>
          <View style={styles.backHit} />
        </View>

        <Text style={styles.title}>{step === 'done' ? 'Payment recorded' : 'Take payment'}</Text>
        <Text style={styles.subtitle}>
          {appointment.client_name} · {serviceLabel}
        </Text>

        {((previewError && !promoFieldError) || payError) && step !== 'totals' && step !== 'done' ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBody}>{payError ?? previewError}</Text>
          </View>
        ) : null}
        {previewError && step === 'totals' && !promoFieldError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBody}>{previewError}</Text>
          </View>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}>
          {step === 'totals' ? (
            <>
              <Text style={styles.sectionLabel}>Tip</Text>
              <Text style={styles.help}>Presets use balance after discounts. Totals update as you go.</Text>
              <View style={styles.tipRow}>
                {TIP_PRESETS_PCT.map((pct) => (
                  <Pressable
                    key={pct}
                    style={[styles.tipChip, (busy || baseBeforeTip == null) && styles.disabled]}
                    disabled={busy || baseBeforeTip == null}
                    onPress={() => applyTipPercent(pct)}>
                    <Text style={styles.tipChipText}>{pct}%</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={tipStr}
                onChangeText={(t) => setTipStr(t)}
              />

              <Text style={[styles.sectionLabel, styles.gap]}>Promo code</Text>
              <Text style={styles.help}>Optional.</Text>
              <TextInput
                style={[styles.input, promoFieldError ? styles.inputErr : null]}
                autoCapitalize="characters"
                placeholder="CODE"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={promoStr}
                onChangeText={(t) => {
                  setPromoStr(t);
                  setPromoFieldError(null);
                }}
              />
              {promoFieldError ? <Text style={styles.fieldErr}>{promoFieldError}</Text> : null}

              {customerId != null && (redeemOfferings.length > 0 || needMorePointsOfferings.length > 0 || rewardsWarning || pointsBalance != null) ? (
                <>
                  <Text style={[styles.sectionLabel, styles.gap]}>Rewards</Text>
                  {pointsBalance != null ? (
                    <Text style={styles.pointsBalanceLine}>Client balance: {pointsBalance} pts</Text>
                  ) : null}
                  {rewardsWarning ? <Text style={styles.warnInline}>{rewardsWarning}</Text> : null}

                  {redeemOfferings.length > 0 ? (
                    <>
                      <Text style={styles.subSectionLabel}>Redeem on this visit</Text>
                      <Text style={styles.helpSmall}>Only rewards that apply to this service and order.</Text>
                      <View style={styles.chipRow}>
                        <Pressable
                          style={[styles.chip, rewardId === null && styles.chipOn]}
                          onPress={() => {
                            setRewardId(null);
                            rewardIdRef.current = null;
                          }}>
                          <Text style={[styles.chipTxt, rewardId === null && styles.chipTxtOn]}>None</Text>
                        </Pressable>
                        {redeemOfferings.map((o) => (
                          <Pressable
                            key={o.id}
                            style={[styles.chip, rewardId === o.id && styles.chipOn]}
                            onPress={() => {
                              setRewardId(o.id);
                              rewardIdRef.current = o.id;
                            }}>
                            <Text style={[styles.chipTxt, rewardId === o.id && styles.chipTxtOn]} numberOfLines={2}>
                              {o.title} ({o.point_cost} pts)
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : !rewardsWarning ? (
                    <Text style={styles.mutedSmall}>No rewards available to redeem on this visit (points or rules).</Text>
                  ) : null}

                  {needMorePointsOfferings.length > 0 ? (
                    <>
                      <Text style={[styles.subSectionLabel, styles.gapSm]}>More in catalog (need more points)</Text>
                      {needMorePointsOfferings.map((o) => {
                        const need = Math.max(0, o.point_cost - (pointsBalance ?? 0));
                        return (
                          <View key={o.id} style={styles.lockedRow}>
                            <Text style={styles.lockedTitle} numberOfLines={2}>
                              {o.title}
                            </Text>
                            <Text style={styles.lockedMeta}>
                              {o.point_cost} pts · need {need} more
                            </Text>
                          </View>
                        );
                      })}
                    </>
                  ) : null}
                </>
              ) : null}

              {preview ? (
                <View style={[styles.summaryCard, styles.gap]}>
                  <Text style={styles.dueLabel}>Total due</Text>
                  <Text style={styles.dueAmt}>${formatMoney(preview.grand_total)}</Text>
                  {busy ? <Text style={styles.updatingHint}>Updating…</Text> : null}
                  <View style={styles.divider} />
                  <Text style={styles.sumLine}>Service ${formatMoney(preview.service_subtotal)}</Text>
                  {preview.promo_discount > 0 ? (
                    <Text style={styles.sumDiscount}>Promo −${formatMoney(preview.promo_discount)}</Text>
                  ) : null}
                  {preview.reward_discount > 0 ? (
                    <Text style={styles.sumDiscount}>Reward −${formatMoney(preview.reward_discount)}</Text>
                  ) : null}
                  <Text style={styles.sumLine}>Tip ${formatMoney(preview.tip)}</Text>
                  {preview.customer_reward_points != null ? (
                    <Text style={styles.points}>Points after preview: {preview.customer_reward_points}</Text>
                  ) : null}
                  <Text style={styles.points}>Points you&apos;ll earn (estimate): {preview.points_to_earn}</Text>
                </View>
              ) : busy ? (
                <View style={[styles.summaryCard, styles.gap]}>
                  <ActivityIndicator color={NavbarColors.text} />
                </View>
              ) : null}

              <Pressable
                style={[styles.primaryBtn, (busy || !preview) && styles.disabled]}
                disabled={busy || !preview}
                onPress={() => void continueToPayment()}>
                <Text style={styles.primaryTxt}>{busy ? 'Checking…' : 'Continue to payment'}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'method' && preview ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.dueLabel}>Amount due</Text>
                <Text style={styles.dueAmt}>${formatMoney(preview.grand_total)}</Text>
                <View style={styles.divider} />
                <Text style={styles.sumLine}>Service ${formatMoney(preview.service_subtotal)}</Text>
                {preview.promo_discount > 0 ? (
                  <Text style={styles.sumDiscount}>Promo −${formatMoney(preview.promo_discount)}</Text>
                ) : null}
                {preview.reward_discount > 0 ? (
                  <Text style={styles.sumDiscount}>Reward −${formatMoney(preview.reward_discount)}</Text>
                ) : null}
                <Text style={styles.sumLine}>Tip ${formatMoney(preview.tip)}</Text>
              </View>

              <Text style={[styles.sectionLabel, styles.gap]}>How are they paying?</Text>
              <Pressable style={styles.payChoice} onPress={() => setStep('cash')}>
                <Text style={styles.payChoiceTitle}>Cash</Text>
                <Text style={styles.payChoiceSub}>Tender and change</Text>
              </Pressable>
              <Pressable style={styles.payChoice} onPress={() => setStep('card')}>
                <Text style={styles.payChoiceTitle}>Card</Text>
                <Text style={styles.payChoiceSub}>Square API (server)</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'cash' && preview ? (
            <>
              <View style={styles.registerCard}>
                <Text style={styles.registerDue}>DUE</Text>
                <Text style={styles.registerDueAmt}>${formatMoney(preview.grand_total)}</Text>
              </View>
              <Text style={styles.sectionLabel}>Cash received</Text>
              <TextInput
                style={[styles.input, cashFieldError ? styles.inputErr : null]}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={cashStr}
                onChangeText={(t) => {
                  setCashStr(t);
                  setCashFieldError(null);
                  setPayError(null);
                }}
              />
              {cashFieldError ? <Text style={styles.fieldErr}>{cashFieldError}</Text> : null}
              {changePreview != null ? (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>Change due</Text>
                  <Text style={styles.changeAmt}>${formatMoney(changePreview)}</Text>
                </View>
              ) : cashStr.trim().length > 0 ? (
                <Text style={styles.warnInline}>Enter at least the amount due to show change.</Text>
              ) : null}
              <Pressable
                style={[styles.primaryBtn, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void runCash()}>
                <Text style={styles.primaryTxt}>Complete cash payment</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'card' && preview ? (
            <>
              <Text style={styles.help}>
                Open the Square card form, enter a sandbox test card, tap Create card token, then the app charges $
                {formatMoney(preview.grand_total)} on the server and updates the invoice.
              </Text>
              <Pressable
                style={[styles.primaryBtn, busy && styles.disabled]}
                disabled={busy}
                onPress={openSquareCardModal}>
                <Text style={styles.primaryTxt}>{busy ? 'Processing…' : 'Enter card & pay'}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'done' && lastPayment ? (
            <View style={styles.doneWrap}>
              <View style={styles.summaryCard}>
                <Text style={styles.doneCheck}>✓</Text>
                <Text style={styles.dueLabel}>Paid</Text>
                <Text style={styles.dueAmt}>${formatMoney(lastPayment.grand_total)}</Text>
                <View style={styles.divider} />
                <Text style={styles.sumLine}>
                  {lastPayment.payment_method === 'cash' ? 'Cash' : 'Card'}
                  {lastPayment.payment_method === 'cash' ? (
                    <>
                      {' · '}
                      received ${formatMoney(lastPayment.amount_received)}
                    </>
                  ) : null}
                </Text>
                {lastPayment.payment_method === 'cash' ? (
                  <Text style={styles.sumLine}>Change ${formatMoney(lastPayment.change_due)}</Text>
                ) : null}
                <Text style={[styles.points, styles.gapSm]}>
                  Points earned: {lastPayment.points_awarded}
                  {lastPayment.customer_reward_points != null
                    ? ` · New balance: ${lastPayment.customer_reward_points} pts`
                    : ''}
                </Text>
              </View>
              <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
                <Text style={styles.primaryTxt}>Done</Text>
              </Pressable>
            </View>
          ) : null}

          {step !== 'done' ? (
            <Text style={styles.footerNote}>Receipt email/SMS from this app is not set up yet.</Text>
          ) : null}
        </ScrollView>
      </View>

      <SquareCardTokenModal
        visible={squareModalVisible}
        applicationId={SQUARE_APPLICATION_ID}
        locationId={SQUARE_LOCATION_ID}
        instanceKey={squareModalKey}
        onClose={() => setSquareModalVisible(false)}
        onToken={(nonce) => void completeCardWithNonce(nonce)}
        onError={(message) => {
          setPayError(message);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backHit: { minWidth: 72 },
  backText: { color: NavbarColors.textMuted, fontSize: 17, fontWeight: '600' },
  stepPill: {
    fontSize: 12,
    fontWeight: '700',
    color: NavbarColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: 22, fontWeight: '800', color: NavbarColors.text },
  subtitle: { fontSize: 15, color: NavbarColors.textMuted, marginTop: 4, marginBottom: 12 },
  muted: { color: NavbarColors.textMuted, marginTop: 8 },
  mutedSmall: { fontSize: 13, color: NavbarColors.textMuted, marginTop: 6, lineHeight: 18 },
  scrollPad: { paddingBottom: 28 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: NavbarColors.text,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: NavbarColors.textMuted,
    marginTop: 10,
  },
  gap: { marginTop: 18 },
  gapSm: { marginTop: 10 },
  help: { fontSize: 13, color: NavbarColors.textMuted, marginTop: 6, marginBottom: 10, lineHeight: 18 },
  helpSmall: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 16 },
  pointsBalanceLine: { fontSize: 14, fontWeight: '700', color: NavbarColors.text, marginBottom: 6 },
  tipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tipChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  tipChipText: { color: NavbarColors.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: NavbarColors.text,
    fontSize: 17,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  inputErr: { borderColor: C.errorBorder },
  fieldErr: { color: '#ffb4c0', marginTop: 8, fontSize: 13 },
  warnInline: { color: NavbarColors.textMuted, fontSize: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: C.pinkSoft, borderColor: 'rgba(233,30,99,0.55)' },
  chipTxt: { color: NavbarColors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTxtOn: { color: NavbarColors.text },
  lockedRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: 8,
  },
  lockedTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
  lockedMeta: { color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 4 },
  primaryBtn: {
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: C.pink,
    alignItems: 'center',
  },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 17 },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  secondaryBtnText: { color: NavbarColors.text, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.45 },
  errorBanner: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
    marginBottom: 12,
  },
  errorBody: { color: NavbarColors.text, fontSize: 14, lineHeight: 20 },
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  updatingHint: { fontSize: 12, color: NavbarColors.textMuted, marginTop: 4 },
  dueLabel: { fontSize: 12, fontWeight: '700', color: NavbarColors.textMuted, textTransform: 'uppercase' },
  dueAmt: { fontSize: 34, fontWeight: '900', color: NavbarColors.text, marginTop: 4 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  sumLine: { fontSize: 14, color: NavbarColors.textMuted, marginBottom: 4 },
  sumDiscount: { fontSize: 14, color: 'rgba(180,255,200,0.9)', marginBottom: 4 },
  points: { fontSize: 13, color: NavbarColors.textMuted, marginTop: 6 },
  payChoice: {
    marginTop: 12,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  payChoiceTitle: { fontSize: 20, fontWeight: '800', color: NavbarColors.text },
  payChoiceSub: { fontSize: 14, color: NavbarColors.textMuted, marginTop: 4 },
  registerCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(233,30,99,0.45)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerDue: { fontSize: 11, fontWeight: '800', color: NavbarColors.textMuted, letterSpacing: 1.2 },
  registerDueAmt: { fontSize: 36, fontWeight: '900', color: NavbarColors.text, marginTop: 4 },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(80,200,120,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(120,220,160,0.35)',
  },
  changeLabel: { fontSize: 16, fontWeight: '700', color: NavbarColors.text },
  changeAmt: { fontSize: 22, fontWeight: '900', color: 'rgba(200,255,220,0.95)' },
  doneWrap: { paddingTop: 8 },
  doneCheck: { fontSize: 40, color: 'rgba(120,220,160,0.95)', marginBottom: 8, textAlign: 'center' },
  footerNote: {
    marginTop: 24,
    fontSize: 11,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
