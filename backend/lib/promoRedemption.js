const PROMO_TABLE = 'emmasenvy.promo_codes';
const USERS_TABLE = 'emmasenvy.users';

function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase();
}

function promoSelectColumns() {
  return `id, code, discount_type, discount_value, min_purchase_amount,
          expiration_date, usage_limit, current_usage_count, is_active, service_type_id`;
}

async function selectPromoByCode(client, normalizedCode) {
  const r = await client.query(
    `SELECT ${promoSelectColumns()}
     FROM ${PROMO_TABLE}
     WHERE UPPER(TRIM(code)) = $1`,
    [normalizedCode]
  );
  return r.rows[0] || null;
}

async function selectPromoById(client, id) {
  const r = await client.query(
    `SELECT ${promoSelectColumns()}
     FROM ${PROMO_TABLE}
     WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function getUserUsedPromoCodes(client, userId) {
  const r = await client.query(
    `SELECT COALESCE(used_promo_codes, '{}') AS used FROM ${USERS_TABLE} WHERE id = $1`,
    [userId]
  );
  const arr = r.rows[0]?.used;
  return Array.isArray(arr) ? arr.map((x) => Number(x)) : [];
}

function userAlreadyUsedPromo(promoId, usedIds) {
  const id = Number(promoId);
  return usedIds.some((x) => Number(x) === id);
}

/**
 * Shared business checks (no DB writes). `serviceTypeId` is the booking context (appointment.service_type_id).
 * @returns {string|null} error message or null if ok
 */
function promoEligibilityError(row, { subtotal, serviceTypeId, usedPromoIds }) {
  if (!row) return 'Invalid or expired code';
  if (!row.is_active) return 'This code is no longer active';
  if (row.expiration_date && new Date(row.expiration_date) < new Date()) {
    return 'This code has expired';
  }
  const usageLimit = row.usage_limit != null ? row.usage_limit : null;
  const currentUsage = row.current_usage_count != null ? row.current_usage_count : 0;
  if (usageLimit != null && currentUsage >= usageLimit) {
    return 'This code has reached its usage limit';
  }
  const minPurchase = row.min_purchase_amount != null ? Number(row.min_purchase_amount) : 0;
  if (subtotal < minPurchase) {
    return `Minimum purchase of $${minPurchase.toFixed(2)} required`;
  }
  const discountValue = Number(row.discount_value);
  if (row.discount_type === 'flat_amount' && discountValue > subtotal) {
    return 'Discount exceeds subtotal';
  }
  const promoSt = row.service_type_id != null ? Number(row.service_type_id) : null;
  if (promoSt != null) {
    if (serviceTypeId == null || Number.isNaN(Number(serviceTypeId))) {
      return 'This promo applies to a specific service; service_type_id is required';
    }
    if (Number(serviceTypeId) !== promoSt) {
      return 'This promo does not apply to this service';
    }
  }
  if (userId != null && userAlreadyUsedPromo(row.id, usedPromoIds)) {
    return 'You have already used this promo code';
  }
  return null;
}

/**
 * Atomically increment global usage and record per-customer redemption.
 * @param {import('pg').PoolClient} client
 */
async function redeemPromo(client, promoId, customerId) {
  const inc = await client.query(
    `UPDATE ${PROMO_TABLE}
     SET current_usage_count = COALESCE(current_usage_count, 0) + 1
     WHERE id = $1
       AND is_active = true
       AND (usage_limit IS NULL OR COALESCE(current_usage_count, 0) < usage_limit)
     RETURNING id`,
    [promoId]
  );
  if (inc.rowCount === 0) {
    const err = new Error('Promo could not be applied (limit or availability)');
    err.statusCode = 400;
    throw err;
  }
  const userUp = await client.query(
    `UPDATE ${USERS_TABLE}
     SET used_promo_codes = array_append(COALESCE(used_promo_codes, '{}'), $1::integer)
     WHERE id = $2
       AND NOT ($1::integer = ANY(COALESCE(used_promo_codes, '{}')))
     RETURNING id`,
    [promoId, customerId]
  );
  if (userUp.rowCount === 0) {
    const err = new Error('You have already used this promo code');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  normalizePromoCode,
  promoSelectColumns,
  selectPromoByCode,
  selectPromoById,
  getUserUsedPromoCodes,
  promoEligibilityError,
  userAlreadyUsedPromo,
  redeemPromo,
  PROMO_TABLE,
  USERS_TABLE,
};
