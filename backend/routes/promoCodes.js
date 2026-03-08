const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const TABLE = 'emmasenvy.promo_codes';

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
  };
}

// GET /api/promo-codes – list all (admin)
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT id, code, discount_type, discount_value, min_purchase_amount,
              expiration_date, usage_limit, current_usage_count, is_active, created_at
       FROM ${TABLE}
       ORDER BY created_at DESC, id DESC`
    );
    const promo_codes = result.rows.map(rowToPromoCode);
    return res.json({ promo_codes });
  } catch (err) {
    return next(err);
  }
});

// GET /api/promo-codes/validate?code=XXX&subtotal=YYY – validate for POS (any authenticated user)
router.get('/validate', requireAuth, async (req, res, next) => {
  try {
    const code = (req.query.code && String(req.query.code).trim()) || '';
    const normalizedCode = code.toUpperCase();
    if (!normalizedCode) return res.status(400).json({ error: 'Code is required' });
    const subtotal = parseFloat(req.query.subtotal);
    if (Number.isNaN(subtotal) || subtotal < 0) return res.status(400).json({ error: 'Valid subtotal is required' });

    const result = await db.pool.query(
      `SELECT id, code, discount_type, discount_value, min_purchase_amount,
              expiration_date, usage_limit, current_usage_count, is_active
       FROM ${TABLE}
       WHERE UPPER(TRIM(code)) = $1`,
      [normalizedCode]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Invalid or expired code' });
    if (!row.is_active) return res.status(400).json({ error: 'This code is no longer active' });
    if (row.expiration_date && new Date(row.expiration_date) < new Date()) {
      return res.status(400).json({ error: 'This code has expired' });
    }
    const usageLimit = row.usage_limit != null ? row.usage_limit : null;
    const currentUsage = row.current_usage_count != null ? row.current_usage_count : 0;
    if (usageLimit != null && currentUsage >= usageLimit) {
      return res.status(400).json({ error: 'This code has reached its usage limit' });
    }
    const minPurchase = row.min_purchase_amount != null ? Number(row.min_purchase_amount) : 0;
    if (subtotal < minPurchase) {
      return res.status(400).json({ error: `Minimum purchase of $${minPurchase.toFixed(2)} required` });
    }
    const discountValue = Number(row.discount_value);
    if (row.discount_type === 'flat_amount' && discountValue > subtotal) {
      return res.status(400).json({ error: 'Discount exceeds subtotal' });
    }
    return res.json({
      discount_type: row.discount_type,
      discount_value: discountValue,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/promo-codes/:id – get one (admin)
router.get('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `SELECT id, code, discount_type, discount_value, min_purchase_amount,
              expiration_date, usage_limit, current_usage_count, is_active, created_at
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

// POST /api/promo-codes – create (admin)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { code, discount_type, discount_value, min_purchase_amount, expiration_date, usage_limit, is_active } = req.body;
    const rawCode = (code && String(code).trim()) || '';
    const normalizedCode = rawCode.toUpperCase();
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

    const result = await db.pool.query(
      `INSERT INTO ${TABLE}
       (code, discount_type, discount_value, min_purchase_amount, expiration_date, usage_limit, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, code, discount_type, discount_value, min_purchase_amount,
                 expiration_date, usage_limit, current_usage_count, is_active, created_at`,
      [normalizedCode, dt, value, minPurchase, expDate, usageLimit, active]
    );
    return res.status(201).json({ promo_code: rowToPromoCode(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A promo code with this code already exists' });
    return next(err);
  }
});

// PATCH /api/promo-codes/:id – update (admin); do not allow changing code
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { discount_type, discount_value, min_purchase_amount, expiration_date, usage_limit, is_active } = req.body;

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
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, code, discount_type, discount_value, min_purchase_amount,
                 expiration_date, usage_limit, current_usage_count, is_active, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promo code not found' });
    return res.json({ promo_code: rowToPromoCode(result.rows[0]) });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/promo-codes/:id – delete (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
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
