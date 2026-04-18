// This file is used to handle the POS API for the frontend
import { apiUrl, fetchWithAuth } from '@/lib/api'; //Import the apiUrl and fetchWithAuth from the lib/api for the api url and fetch with auth
import type { RewardOfferingDto } from '@/lib/rewards-api'; //Import the RewardOfferingDto from the lib/rewards-api for the reward offering dto

// Function to read the error
async function readError(res: Response): Promise<string> {
  //Try to read the error
  try {
    const data = (await res.json()) as { error?: string }; //Set the data to the data from the response
    return data.error || res.statusText || `HTTP ${res.status}`; //Return the error
  } catch {
    return res.statusText || `HTTP ${res.status}`; //Return the error
  }
}
// Interface for the POS preview response
export interface PosPreviewResponse {
  appointment_id: number; //The appointment id for the POS preview response
  invoice_id: number; //The invoice id for the POS preview response
  customer_id: number | null; //The customer id for the POS preview response
  service_subtotal: number; //The service subtotal for the POS preview response
  promo_discount: number; //The promo discount for the POS preview response
  reward_discount: number; //The reward discount for the POS preview response
  pre_tip_total: number; //The pre tip total for the POS preview response
  tip: number; //The tip for the POS preview response
  grand_total: number; //The grand total for the POS preview response
  points_to_earn: number; //The points to earn for the POS preview response
  idempotency_key: string; //The idempotency key for the POS preview response
  customer_reward_points: number | null; //The customer reward points for the POS preview response
}

// Interface for the POS preview body
export interface PosPreviewBody {
  appointmentId: number; //The appointment id for the POS preview body
  tip?: number; //The tip for the POS preview body
  promoCode?: string; //The promo code for the POS preview body
  promo_code_id?: number; //The promo code id for the POS preview body
  reward_offering_id?: number; //The reward offering id for the POS preview body
}

// Function to preview the POS
export async function posPreview(token: string, body: PosPreviewBody): Promise<PosPreviewResponse> {
  //Try to preview the POS
  const res = await fetchWithAuth(
    apiUrl('/api/pos/preview'),
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    token
  );
  if (!res.ok) throw new Error(await readError(res)); //If the response is not ok, then throw an error
  return (await res.json()) as PosPreviewResponse; //Return the response as the POS preview response
}

// Interface for the complete card body
export interface CompleteCardBody extends PosPreviewBody {
  squarePaymentId: string; //The square payment id for the complete card body
  checkout_idempotency_key: string; //The checkout idempotency key for the complete card body
}

// Interface for the POS payment success
export interface PosPaymentSuccess {
  success: boolean; //The success for the POS payment success
  invoiceId: number; //The invoice id for the POS payment success
  square_payment_id?: string; //The square payment id for the POS payment success
  points_awarded: number; //The points awarded for the POS payment success
  customer_reward_points: number | null; //The customer reward points for the POS payment success
  payment_method: 'cash' | 'card'; //The payment method for the POS payment success
  grand_total: number; //The grand total for the POS payment success
  amount_received: number; //The amount received for the POS payment success
  change_due: number; //The change due for the POS payment success
}

// Function to complete the card
export async function posCompleteCard(token: string, body: CompleteCardBody): Promise<PosPaymentSuccess> {
  //Try to complete the card
  const res = await fetchWithAuth(
    apiUrl('/api/pos/complete-card'),
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    token
  );
  if (!res.ok) throw new Error(await readError(res)); //If the response is not ok, then throw an error
  return (await res.json()) as PosPaymentSuccess; //Return the response as the POS payment success
}

// Function to charge the card via the API
export async function posChargeCardApi(
  authToken: string, //The auth token for the POS charge card API
  body: PosPreviewBody & { checkout_idempotency_key: string; square_card_nonce?: string } //The body for the POS charge card API
): Promise<PosPaymentSuccess> {
  //Try to charge the card via the API
  const res = await fetchWithAuth(
    apiUrl('/api/pos/charge-card-api'),
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    authToken
  );
  if (!res.ok) throw new Error(await readError(res)); //If the response is not ok, then throw an error
  return (await res.json()) as PosPaymentSuccess; //Return the response as the POS payment success
}

// Interface for the record cash body
export interface RecordCashBody extends PosPreviewBody {
  paymentMethod: 'cash'; //The payment method for the record cash body
  amountReceived: number; //The amount received for the record cash body
  checkout_idempotency_key: string; //The checkout idempotency key for the record cash body
}

// Interface for the customer eligible response
export interface CustomerEligibleResponse {
  points: number; //The points for the customer eligible response
  reward_offerings: RewardOfferingDto[]; //The reward offerings for the customer eligible response
}

// Function to get the customer eligible rewards
export async function getCustomerEligibleRewards(
  token: string, //The token for the get customer eligible rewards
  params: { customerId: number; subtotal: number; service_type_id: number } //The params for the get customer eligible rewards
): Promise<CustomerEligibleResponse> {
  //Try to get the customer eligible rewards
  const qs = new URLSearchParams({
    customerId: String(params.customerId), //Set the customerId to the customerId
    subtotal: String(params.subtotal), //Set the subtotal to the subtotal
    service_type_id: String(params.service_type_id), //Set the service_type_id to the service_type_id
  });
  //Try to fetch the customer eligible rewards
  const res = await fetchWithAuth(
    apiUrl(`/api/reward-offerings/customer-eligible?${qs.toString()}`),
    { method: 'GET', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res)); //If the response is not ok, then throw an error
  return (await res.json()) as CustomerEligibleResponse; //Return the response as the customer eligible response
}

// Function to record the cash payment
export async function posRecordCashPayment(token: string, body: RecordCashBody): Promise<PosPaymentSuccess> {
  //Try to record the cash payment
  const res = await fetchWithAuth(
    apiUrl('/api/pos/record-payment'), //The url for the record cash payment
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, //The options for the fetch
    token //The token for the record cash payment
  );
  if (!res.ok) throw new Error(await readError(res)); //If the response is not ok, then throw an error
  return (await res.json()) as PosPaymentSuccess; //Return the response as the POS payment success
}
