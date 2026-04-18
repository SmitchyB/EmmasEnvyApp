// This file is used to get the square client and the payment from the square service
const crypto = require('crypto'); //crypto is used to create a hash of the idempotency key
const { SquareClient, SquareEnvironment } = require('square'); //SquareClient and SquareEnvironment are the square client and environment
const { roundMoney } = require('./posCheckout'); //roundMoney is the function to round the money

// Function to get the square client
function getSquareClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN; //Set the token to the square access token
  //If the token is not set or is not a string, then throw an error
  if (!token || !String(token).trim()) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set'); //Throw an error
  }
  const env = process.env.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox; //Set the environment to the production environment if the square environment is production, otherwise set the environment to the sandbox environment
 
  //Return the square client
  return new SquareClient({
    token: String(token).trim(), //Set the token to the token
    environment: env, //Set the environment to the environment
  });
}

// Function to get the payment
async function getPayment(paymentId) {
  const client = getSquareClient(); //Get the square client
  const res = await client.payments.get({ paymentId }); //Get the payment from the square service
  const payment = res && res.payment != null ? res.payment : res && res.data && res.data.payment; //Set the payment to the payment from the square service
  //If the payment is not set, then throw an error
  if (!payment) {
    throw new Error('Square get payment returned no payment object'); //Throw an error
  }
  return payment; //Return the payment
}

// Function to convert the money to dollars
function moneyToDollars(money) {
  if (!money || money.amount == null) return 0; //If the money is not set or the amount is not set, then return 0
  const raw = money.amount; //Set the raw to the amount from the money
  const n = typeof raw === 'bigint' ? Number(raw) : Number(raw); //Set the n to the number from the raw
  if (Number.isNaN(n)) return 0; //If the n is not a number, then return 0
  return roundMoney(n / 100); //Return the money to dollars
}

// Function to verify the payment total
function verifyPaymentTotal(payment, expectedGrandTotal) {
  if (!payment) return { ok: false, actualTotal: 0 }; //If the payment is not set, then return false and 0
  const status = payment.status != null ? String(payment.status) : ''; //Set the status to the status from the payment
  const okStatus = status === 'COMPLETED' || status === 'APPROVED'; //Set the ok status to the ok status from the payment
  //If the ok status is not set, then return false and 0
  if (!okStatus) {
    return { ok: false, actualTotal: moneyToDollars(payment.totalMoney), status }; //Return false and the actual total
  }
  const actual = moneyToDollars(payment.totalMoney); //Set the actual to the actual from the payment
  const diff = Math.abs(actual - roundMoney(expectedGrandTotal)); //Set the diff to the diff from the actual and expected grand total
  return { ok: diff < 0.02, actualTotal: actual, status }; //Return the ok status, actual total, and status
}

// Function to create a card payment
async function createApiCardPayment(opts) {
  const { amountDollars, idempotencyKeySuffix, note, sourceId: sourceIdFromClient } = opts; //Set the amount dollars, idempotency key suffix, note, and source id from the options
  const trimmedClient = sourceIdFromClient && String(sourceIdFromClient).trim(); //Set the trimmed client to the trimmed client from the options
  //Set the source id to the source id from the options
  const sourceId =
    trimmedClient ||
    (process.env.SQUARE_SANDBOX_CARD_NONCE && String(process.env.SQUARE_SANDBOX_CARD_NONCE).trim()) ||
    (process.env.SQUARE_API_CARD_SOURCE_ID && String(process.env.SQUARE_API_CARD_SOURCE_ID).trim());
  
  //If the source id is not set, then throw an error
  if (!sourceId) {
    throw new Error('Provide square_card_nonce from the app (Web Payments), or set SQUARE_SANDBOX_CARD_NONCE / SQUARE_API_CARD_SOURCE_ID on the server'); //Throw an error
  }
  const locationId = process.env.SQUARE_LOCATION_ID; //Set the location id to the location id from the environment
  //If the location id is not set or is not a string, then throw an error
  if (!locationId || !String(locationId).trim()) {
    throw new Error('SQUARE_LOCATION_ID is required'); //Throw an error
  }
  const amountCents = Math.round(roundMoney(amountDollars) * 100); //Set the amount cents to the amount cents from the amount dollars
  //If the amount cents is less than 1, then throw an error
  if (amountCents < 1) {
    throw new Error('Amount must be at least $0.01'); //Throw an error
  }
  const idempotencyKey = `sq${crypto.randomUUID().replace(/-/g, '')}`; //Set the idempotency key to the idempotency key from the crypto

  //Set the checkout fp to the checkout fp from the idempotency key suffix
  const checkoutFp =
    idempotencyKeySuffix != null && String(idempotencyKeySuffix).trim()
      ? crypto.createHash('sha256').update(String(idempotencyKeySuffix)).digest('hex').slice(0, 8) //Set the checkout fp to the checkout fp from the idempotency key suffix
      : ''; //Set the checkout fp to the empty string

  //Log the payments.create (API test)
  console.log('[POS][Square] payments.create (API test)', {
    locationId: String(locationId).trim(), //Set the location id to the location id from the environment
    amountCents, //Set the amount cents to the amount cents from the amount dollars
    idempotencyKey, //Set the idempotency key to the idempotency key from the crypto
    checkout_idempotency_fp: checkoutFp || undefined, //Set the checkout fp to the checkout fp from the idempotency key suffix
  });

  const client = getSquareClient(); //Get the square client
  //Create the payment
  const response = await client.payments.create({
    idempotencyKey, //Set the idempotency key to the idempotency key from the crypto
    locationId: String(locationId).trim(), //Set the location id to the location id from the environment
    sourceId, //Set the source id to the source id from the options
    amountMoney: { amount: BigInt(amountCents), currency: 'USD' }, //Set the amount money to the amount money from the amount cents
    autocomplete: true, //Set the autocomplete to true
    note: note || 'EmmasEnvy POS (Payments API)', //Set the note to the note from the options
  });

  const raw = response && (response.data !== undefined ? response.data : response); //Set the raw to the raw from the response
  //Set the payment to the payment from the raw
  const payment =
    raw && raw.payment !== undefined
      ? raw.payment
      : raw && raw.data && raw.data.payment !== undefined
        ? raw.data.payment
        : null;

  const squarePaymentId = payment && payment.id != null ? String(payment.id) : ''; //Set the square payment id to the square payment id from the payment
  const status = payment && payment.status != null ? String(payment.status) : ''; //Set the status to the status from the payment
  //Log the payments.create result
  console.log('[POS][Square] payments.create result', {
    squarePaymentId, //Set the square payment id to the square payment id from the payment
    status, //Set the status to the status from the payment
    amount: payment && payment.amountMoney && payment.amountMoney.amount != null ? String(payment.amountMoney.amount) : undefined, //Set the amount to the amount from the payment
  });
  //If the square payment id is not set, then throw an error
  if (!squarePaymentId) {
    throw new Error('Square Payments API did not return a payment id'); //Throw an error
  }
  return { payment, squarePaymentId }; //Return the payment and the square payment id
}

//Export the functions
module.exports = {
  getSquareClient, //getSquareClient is the function to get the square client
  getPayment, //getPayment is the function to get the payment
  moneyToDollars, //moneyToDollars is the function to convert the money to dollars
  verifyPaymentTotal, //verifyPaymentTotal is the function to verify the payment total
  createApiCardPayment, //createApiCardPayment is the function to create a card payment
};
