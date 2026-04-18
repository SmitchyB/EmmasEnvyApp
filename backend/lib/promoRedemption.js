// This file is used to handle the promo redemption process for the backend
const PROMO_TABLE = 'emmasenvy.promo_codes'; //PROMO_TABLE is the table name for the promo codes
const USERS_TABLE = 'emmasenvy.users'; //USERS_TABLE is the table name for the users
 
// Function to normalize the promo code
function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase(); //Return the normalized promo code
}

// Function to select the promo columns
function promoSelectColumns() {
  return `id, code, discount_type, discount_value, min_purchase_amount,
          expiration_date, usage_limit, current_usage_count, is_active, service_type_id`;
}

// Function to select the promo code by code
async function selectPromoByCode(client, normalizedCode) {
  //Select the promo code by code
  const r = await client.query(
    `SELECT ${promoSelectColumns()}
     FROM ${PROMO_TABLE}
     WHERE UPPER(TRIM(code)) = $1`,
    [normalizedCode]
  );
  return r.rows[0] || null; //Return the promo code by code
}

// Function to select the promo code by id
async function selectPromoById(client, id) {
  //Select the promo code by id
  const r = await client.query(
    `SELECT ${promoSelectColumns()}
     FROM ${PROMO_TABLE}
     WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

// Function to get the user used promo codes
async function getUserUsedPromoCodes(client, userId) {
  const id = typeof userId === 'number' ? userId : parseInt(String(userId), 10); //Set the id to the user id
  //If the id is not an integer or is less than 1, then return an empty array
  if (!Number.isInteger(id) || id < 1) {
    return []; //Return an empty array
  }
  const r = await client.query(`SELECT used_promo_codes FROM ${USERS_TABLE} WHERE id = $1`, [id]); //Select the user used promo codes
  const raw = r.rows[0]?.used_promo_codes; //Set the raw to the user used promo codes
  if (raw == null) return []; //Return an empty array
  //If the raw is an array, then return the raw
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n)); //Return the raw as an array of numbers
  }
  const n = Number(raw); //Set the n to the number from the raw
  return Number.isFinite(n) ? [n] : []; //Return the n as an array of numbers
}

// Function to check if the user has already used the promo
function userAlreadyUsedPromo(promoId, usedIds) {
  const id = Number(promoId); //Set the id to the promo id
  return usedIds.some((x) => Number(x) === id); //Return true if the user has already used the promo
}

// Function to check if the promo is eligible
function promoEligibilityError(row, { subtotal, serviceTypeId, usedPromoIds }) {
  if (!row) return 'Invalid or expired code'; //Return 'Invalid or expired code'
  if (!row.is_active) return 'This code is no longer active'; //Return 'This code is no longer active'
  //If the expiration date is set and the expiration date is less than the current date, then return 'This code has expired'
  if (row.expiration_date && new Date(row.expiration_date) < new Date()) {
    return 'This code has expired';
  }
  const usageLimit = row.usage_limit != null ? row.usage_limit : null; //Set the usage limit to the usage limit from the row
  const currentUsage = row.current_usage_count != null ? row.current_usage_count : 0; //Set the current usage to the current usage from the row
  //If the usage limit is set and the current usage is greater than or equal to the usage limit, then return 'This code has reached its usage limit'
  if (usageLimit != null && currentUsage >= usageLimit) {
    return 'This code has reached its usage limit'; //Return 'This code has reached its usage limit'
  }
  const minPurchase = row.min_purchase_amount != null ? Number(row.min_purchase_amount) : 0; //Set the minimum purchase to the minimum purchase from the row
  //If the subtotal is less than the minimum purchase, then return 'Minimum purchase of $${minPurchase.toFixed(2)} required'
  if (subtotal < minPurchase) {
    return `Minimum purchase of $${minPurchase.toFixed(2)} required`; //Return 'Minimum purchase of $${minPurchase.toFixed(2)} required'
  }
  const discountValue = Number(row.discount_value); //Set the discount value to the discount value from the row
  //If the discount type is flat amount and the discount value is greater than the subtotal, then return 'Discount exceeds subtotal'
  if (row.discount_type === 'flat_amount' && discountValue > subtotal) {
    return 'Discount exceeds subtotal'; //Return 'Discount exceeds subtotal'
  }
  const promoSt = row.service_type_id != null ? Number(row.service_type_id) : null; //Set the promo service type id to the promo service type id from the row
  //If the promo service type id is set, then check if the service type id is set and if the service type id is not a number, then return 'This promo applies to a specific service; service_type_id is required'
  if (promoSt != null) {
    //If the service type id is not set or is not a number, then return 'This promo applies to a specific service; service_type_id is required'
    if (serviceTypeId == null || Number.isNaN(Number(serviceTypeId))) {
      return 'This promo applies to a specific service; service_type_id is required'; 
    }
    //If the service type id is not equal to the promo service type id, then return 'This promo does not apply to this service'
    if (Number(serviceTypeId) !== promoSt) {
      return 'This promo does not apply to this service';
    }
  }
  const used = Array.isArray(usedPromoIds) ? usedPromoIds : []; //Set the used to the used promo ids from the row
  //If the user has already used the promo, then return 'You have already used this promo code'
  if (userAlreadyUsedPromo(row.id, used)) {
    return 'You have already used this promo code';
  }
  return null; //Return null
}

// Function to redeem the promo
async function redeemPromo(client, promoId, customerId) {
  //Increment the current usage count
  const inc = await client.query(
    `UPDATE ${PROMO_TABLE}
     SET current_usage_count = COALESCE(current_usage_count, 0) + 1
     WHERE id = $1
       AND is_active = true
       AND (usage_limit IS NULL OR COALESCE(current_usage_count, 0) < usage_limit)
     RETURNING id`,
    [promoId]
  );
  //If the current usage count is 0, then throw an error
  if (inc.rowCount === 0) {
    const err = new Error('Promo could not be applied (limit or availability)'); //Throw an error
    err.statusCode = 400; //Set the status code to 400
    throw err; //Throw the error
  }
  //Append the promo id to the user used promo codes
  const userUp = await client.query(
    `UPDATE ${USERS_TABLE}
     SET used_promo_codes = array_append(COALESCE(used_promo_codes, ARRAY[]::integer[]), $1::integer)
     WHERE id = $2
       AND NOT ($1::integer = ANY(COALESCE(used_promo_codes, ARRAY[]::integer[])))
     RETURNING id`,
    [promoId, customerId]
  );
  //If the user used promo codes is 0, then throw an error
  if (userUp.rowCount === 0) {
    const err = new Error('You have already used this promo code'); //Throw an error
    err.statusCode = 400; //Set the status code to 400
    throw err; //Throw the error
  }
}

//Export the functions
module.exports = {
  normalizePromoCode, //normalizePromoCode is the function to normalize the promo code
  promoSelectColumns, //promoSelectColumns is the function to select the promo columns
  selectPromoByCode, //selectPromoByCode is the function to select the promo code by code
  selectPromoById, //selectPromoById is the function to select the promo code by id
  getUserUsedPromoCodes, //getUserUsedPromoCodes is the function to get the user used promo codes
  promoEligibilityError, //promoEligibilityError is the function to check if the promo is eligible
  userAlreadyUsedPromo, //userAlreadyUsedPromo is the function to check if the user has already used the promo
  redeemPromo, //redeemPromo is the function to redeem the promo
  PROMO_TABLE, //Export the promo table for the promo redemption
  USERS_TABLE, //Export the users table for the promo redemption
};
