const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdminOrIT } = require('../middleware/auth');
const {
  normalizePromoCode,
  selectPromoByCode,
  selectPromoById,
  getUserUsedPromoCodes,
  promoEligibilityError,
} = require('../lib/promoRedemption');

const router = express.Router();
const TABLE = 'emmasenvy.promo_codes';
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type';

const DISCOUNT_TYPES = ['percentage', 'flat_amount'];

function rowToPromoCode(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : 0,
    expiration_date: row.expiration_date,
    usage_limit: row.usage_limit != null ? row.usage_limit : null,
    current_usage_count: row.current_usage_count != null ? row.current_usage_count : 0,
    is_active: row.is_active === true,
    created_at: row.created_at,
    service_type_id: row.service_type_id != null ? Number(row.service_type_id) : null,
  };
}

async function assertServiceTypeExists(serviceTypeId) {
  if (serviceTypeId == null) return;
  const r = await db.pool.query(`SELECT 1 FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`, [serviceTypeId]);
  if (r.rows.length === 0) {
    const err = new Error('service_type_id does not exist');
    err.statusCode = 400;
    throw err;
  }
}

// GET /api/promo-codes – list all (admin / IT)
router.get('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT id, code, discount_type, discount_value, min_purchase_amount,
              expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id
       FROM ${TABLE}
       ORDER BY created_at DESC, id DESC`
    );
    const promo_codes = result.rows.map(rowToPromoCode);
    return res.json({ promo_codes });
  } catch (err) {
    return next(err);
  }
});

// GET /api/promo-codes/validate?code=XXX&subtotal=YYY&service_type_id=ZZZ – validate for POS / checkout
router.get('/validate', requireAuth, async (req, res, next) => {
  try {
    const code = (req.query.code && String(req.query.code).trim()) || '';
    const normalizedCode = normalizePromoCode(code);
    if (!normalizedCode) return res.status(400).json({ error: 'Code is required' });
    const subtotal = parseFloat(req.query.subtotal);
    if (Number.isNaN(subtotal) || subtotal < 0) return res.status(400).json({ error: 'Valid subtotal is required' });
    const serviceTypeId =
      req.query.service_type_id != null && String(req.query.service_type_id).trim() !== ''
        ? parseInt(req.query.service_type_id, 10)
        : null;
    if (req.query.service_type_id != null && req.query.service_type_id !== '' && Number.isNaN(serviceTypeId)) {
      return res.status(400).json({ error: 'Invalid service_type_id' });
    }

    const row = await selectPromoByCode(db.pool, normalizedCode);
    const userId = req.user?.id;
    const usedPromoIds = userId != null ? await getUserUsedPromoCodes(db.pool, userId) : [];
    const errMsg = promoEligibilityError(row, {
      subtotal,
      serviceTypeId,
      usedPromoIds,
    });
    if (errMsg) {
      const status = errMsg === 'Invalid or expired code' ? 404 : 400;
      return res.status(status).json({ error: errMsg });
    }
    const discountValue = Number(row.discount_value);
    return res.json({
      discount_type: row.discount_type,
      discount_value: discountValue,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/promo-codes/:id – get one (admin / IT)
router.get('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `SELECT id, code, discount_type, discount_value, min_purchase_amount,
              expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id
       FROM ${TABLE}
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
    return res.json({ promo_code: rowToPromoCode(result.rows[0]) });
  } catch (err) {
    return next(err);
  }
});

// POST /api/promo-codes – create (admin / IT)
router.post('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_purchase_amount,
      expiration_date,
      usage_limit,
      is_active,
      service_type_id,
    } = req.body;
    const rawCode = (code && String(code).trim()) || '';
    const normalizedCode = normalizePromoCode(rawCode);
    if (!normalizedCode) return res.status(400).json({ error: 'Code is required' });
    const dt = discount_type === 'percent' ? 'percentage' : discount_type === 'fixed' ? 'flat_amount' : discount_type;
    if (!DISCOUNT_TYPES.includes(dt)) return res.status(400).json({ error: 'Invalid discount_type; use percentage or flat_amount' });
    const value = parseFloat(discount_value);
    if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: 'discount_value must be a positive number' });
    if (dt === 'percentage' && value > 100) return res.status(400).json({ error: 'Percentage discount cannot exceed 100' });
    const minPurchase = min_purchase_amount != null ? parseFloat(min_purchase_amount) : 0;
    if (Number.isNaN(minPurchase) || minPurchase < 0) return res.status(400).json({ error: 'min_purchase_amount must be 0 or greater' });
    const usageLimit = usage_limit == null || usage_limit === '' ? null : parseInt(usage_limit, 10);
    if (usage_limit != null && usage_limit !== '' && (Number.isNaN(usageLimit) || usageLimit < 0)) {
      return res.status(400).json({ error: 'usage_limit must be a non-negative integer or null' });
    }
    const expDate = expiration_date && String(expiration_date).trim() ? new Date(expiration_date) : null;
    const active = is_active !== false;
    const svcId =
      service_type_id === null || service_type_id === undefined || service_type_id === ''
        ? null
        : parseInt(service_type_id, 10);
    if (service_type_id != null && service_type_id !== '' && Number.isNaN(svcId)) {
      return res.status(400).json({ error: 'Invalid service_type_id' });
    }
    await assertServiceTypeExists(svcId);

    const result = await db.pool.query(
      `INSERT INTO ${TABLE}
       (code, discount_type, discount_value, min_purchase_amount, expiration_date, usage_limit, is_active, service_type_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, code, discount_type, discount_value, min_purchase_amount,
                 expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id`,
      [normalizedCode, dt, value, minPurchase, expDate, usageLimit, active, svcId]
    );
    return res.status(201).json({ promo_code: rowToPromoCode(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A promo code with this code already exists' });
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    return next(err);
  }
});

// PATCH /api/promo-codes/:id – update (admin / IT); do not allow changing code
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const {
      discount_type,
      discount_value,
      min_purchase_amount,
      expiration_date,
      usage_limit,
      is_active,
      service_type_id,
    } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;
    if (discount_type !== undefined) {
      const dt = discount_type === 'percent' ? 'percentage' : discount_type === 'fixed' ? 'flat_amount' : discount_type;
      if (!DISCOUNT_TYPES.includes(dt)) return res.status(400).json({ error: 'Invalid discount_type' });
      updates.push(`discount_type = $${idx++}`);
      values.push(dt);
    }
    if (discount_value !== undefined) {
      const value = parseFloat(discount_value);
      if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: 'discount_value must be positive' });
      updates.push(`discount_value = $${idx++}`);
      values.push(value);
    }
    if (min_purchase_amount !== undefined) {
      const minPurchase = parseFloat(min_purchase_amount);
      if (Number.isNaN(minPurchase) || minPurchase < 0) return res.status(400).json({ error: 'min_purchase_amount must be >= 0' });
      updates.push(`min_purchase_amount = $${idx++}`);
      values.push(minPurchase);
    }
    if (expiration_date !== undefined) {
      const expDate = expiration_date === null || expiration_date === '' ? null : new Date(expiration_date);
      updates.push(`expiration_date = $${idx++}`);
      values.push(expDate);
    }
    if (usage_limit !== undefined) {
      const usageLimit = usage_limit === null || usage_limit === '' ? null : parseInt(usage_limit, 10);
      if (usage_limit !== null && usage_limit !== '' && (Number.isNaN(usageLimit) || usageLimit < 0)) {
        return res.status(400).json({ error: 'usage_limit must be non-negative integer or null' });
      }
      updates.push(`usage_limit = $${idx++}`);
      values.push(usageLimit);
    }
    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);
    }
    if (service_type_id !== undefined) {
      const svcId =
        service_type_id === null || service_type_id === '' ? null : parseInt(service_type_id, 10);
      if (service_type_id != null && service_type_id !== '' && Number.isNaN(svcId)) {
        return res.status(400).json({ error: 'Invalid service_type_id' });
      }
      await assertServiceTypeExists(svcId);
      updates.push(`service_type_id = $${idx++}`);
      values.push(svcId);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, code, discount_type, discount_value, min_purchase_amount,
                 expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
    return res.json({ promo_code: rowToPromoCode(result.rows[0]) });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    return next(err);
  }
});

// DELETE /api/promo-codes/:id – delete (admin / IT)
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
