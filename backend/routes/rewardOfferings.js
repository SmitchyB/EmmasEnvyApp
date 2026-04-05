/**
 * Reward offerings: admin CRUD + public/checkout "available" list.
 * GET /api/reward-offerings – list all (admin)
 * GET /api/reward-offerings/available – active offerings, optional ?points= & ?subtotal=
 * GET /api/reward-offerings/:id – get one (admin)
 * POST /api/reward-offerings – create (admin)
 * PATCH /api/reward-offerings/:id – update (admin)
 * DELETE /api/reward-offerings/:id – delete (admin)
 */

const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const TABLE = 'emmasenvy.reward_offerings';
const USERS_TABLE = 'emmasenvy.users';

const REWARD_TYPES = ['percent_off', 'dollar_off', 'free_product'];

function rowToOffering(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    reward_type: row.reward_type,
    point_cost: row.point_cost != null ? parseInt(row.point_cost, 10) : 0,
    value: row.value != null ? Number(row.value) : null,
    product_id: row.product_id != null ? parseInt(row.product_id, 10) : null,
    product_title: row.product_title ?? null,
    product_price: row.product_price != null ? Number(row.product_price) : null,
    min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : null,
    is_active: row.is_active === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/reward-offerings/customer-eligible?customerId=&subtotal= – for POS: returns { points, reward_offerings } for that customer (auth required)
router.get('/customer-eligible', requireAuth, async (req, res, next) => {
  try {
    const customerId = req.query.customerId != null ? parseInt(req.query.customerId, 10) : null;
    const subtotal = req.query.subtotal != null ? parseFloat(req.query.subtotal) : null;
    if (customerId == null || Number.isNaN(customerId)) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    const userRow = await db.pool.query(
      `SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`,
      [customerId]
    );
    const points = userRow.rows[0]?.reward_points != null ? parseInt(userRow.rows[0].reward_points, 10) : 0;
    const result = await db.pool.query(
      `SELECT r.id, r.title, r.reward_type, r.point_cost, r.value, r.product_id, r.min_purchase_amount, r.is_active, r.created_at, r.updated_at,
              NULL::text AS product_title, NULL::numeric AS product_price
       FROM ${TABLE} r
       WHERE r.is_active = true AND r.point_cost <= $1
       ORDER BY r.point_cost ASC, r.id ASC`,
      [points]
    );
    let list = result.rows.map(rowToOffering);
    if (subtotal != null && !Number.isNaN(subtotal)) {
      list = list.filter((o) => o.min_purchase_amount == null || o.min_purchase_amount <= subtotal);
    }
    return res.json({ points, reward_offerings: list });
  } catch (err) {
    console.error('[rewardOfferings] GET /customer-eligible error', err);
    return next(err);
  }
});

// GET /api/reward-offerings/available – active offerings; ?points= & ?subtotal= filter affordable
router.get('/available', async (req, res, next) => {
  try {
    const points = req.query.points != null ? parseInt(req.query.points, 10) : null;
    const subtotal = req.query.subtotal != null ? parseFloat(req.query.subtotal) : null;

    const result = await db.pool.query(
      `SELECT r.id, r.title, r.reward_type, r.point_cost, r.value, r.product_id, r.min_purchase_amount, r.is_active, r.created_at, r.updated_at,
              NULL::text AS product_title, NULL::numeric AS product_price
       FROM ${TABLE} r
       WHERE r.is_active = true
       ORDER BY r.point_cost ASC, r.id ASC`
    );
    let list = result.rows.map(rowToOffering);
    if (points != null && !Number.isNaN(points)) {
      list = list.filter((o) => o.point_cost <= points);
    }
    if (subtotal != null && !Number.isNaN(subtotal)) {
      list = list.filter((o) => o.min_purchase_amount == null || o.min_purchase_amount <= subtotal);
    }
    return res.json({ reward_offerings: list });
  } catch (err) {
    console.error('[rewardOfferings] GET /available error', err);
    return next(err);
  }
});

// GET /api/reward-offerings – list all (admin)
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT r.id, r.title, r.reward_type, r.point_cost, r.value, r.product_id, r.min_purchase_amount, r.is_active, r.created_at, r.updated_at,
              NULL::text AS product_title, NULL::numeric AS product_price
       FROM ${TABLE} r
       ORDER BY r.created_at DESC, r.id DESC`
    );
    const reward_offerings = result.rows.map(rowToOffering);
    return res.json({ reward_offerings });
  } catch (err) {
    return next(err);
  }
});

// GET /api/reward-offerings/:id – get one (admin)
router.get('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `SELECT r.id, r.title, r.reward_type, r.point_cost, r.value, r.product_id, r.min_purchase_amount, r.is_active, r.created_at, r.updated_at,
              NULL::text AS product_title, NULL::numeric AS product_price
       FROM ${TABLE} r
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' });
    return res.json({ reward_offering: rowToOffering(result.rows[0]) });
  } catch (err) {
    return next(err);
  }
});

// POST /api/reward-offerings – create (admin)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { title, reward_type, point_cost, value, product_id, min_purchase_amount, is_active } = req.body;
    const titleStr = (title && String(title).trim()) || '';
    if (!titleStr) return res.status(400).json({ error: 'title is required' });
    const rt = (reward_type && String(reward_type).trim()) || '';
    if (!REWARD_TYPES.includes(rt)) {
      return res.status(400).json({ error: 'reward_type must be percent_off, dollar_off, or free_product' });
    }
    const cost = parseInt(point_cost, 10);
    if (Number.isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'point_cost must be a positive integer' });

    let valueNum = null;
    let productId = null;
    if (rt === 'free_product') {
      return res.status(400).json({ error: 'free_product rewards are not available without a product catalog.' });
    }
    if (rt === 'percent_off' || rt === 'dollar_off') {
      valueNum = value != null ? parseFloat(value) : null;
      if (valueNum == null || Number.isNaN(valueNum) || valueNum <= 0) {
        return res.status(400).json({ error: 'value is required and must be positive for percent_off and dollar_off' });
      }
      if (rt === 'percent_off' && valueNum > 100) {
        return res.status(400).json({ error: 'value cannot exceed 100 for percent_off' });
      }
    }
    const minPurchase = min_purchase_amount != null && min_purchase_amount !== '' ? parseFloat(min_purchase_amount) : null;
    if (min_purchase_amount != null && min_purchase_amount !== '' && (Number.isNaN(minPurchase) || minPurchase < 0)) {
      return res.status(400).json({ error: 'min_purchase_amount must be 0 or greater' });
    }
    const active = is_active !== false;
    const now = new Date();

    const result = await db.pool.query(
      `INSERT INTO ${TABLE} (title, reward_type, point_cost, value, product_id, min_purchase_amount, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, title, reward_type, point_cost, value, product_id, min_purchase_amount, is_active, created_at, updated_at`,
      [titleStr, rt, cost, valueNum, productId, minPurchase, active, now]
    );
    const row = result.rows[0];
    const out = rowToOffering({ ...row, product_title: null });
    return res.status(201).json({ reward_offering: out });
  } catch (err) {
    console.error('[rewardOfferings] POST / error', err);
    return next(err);
  }
});

// PATCH /api/reward-offerings/:id – update (admin)
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { title, reward_type, point_cost, value, product_id, min_purchase_amount, is_active } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) {
      const titleStr = (title && String(title).trim()) || '';
      if (!titleStr) return res.status(400).json({ error: 'title cannot be empty' });
      updates.push(`title = $${idx++}`);
      values.push(titleStr);
    }
    if (reward_type !== undefined) {
      const rt = String(reward_type).trim();
      if (!REWARD_TYPES.includes(rt)) return res.status(400).json({ error: 'Invalid reward_type' });
      if (rt === 'free_product') {
        return res.status(400).json({ error: 'free_product rewards are not available without a product catalog.' });
      }
      updates.push(`reward_type = $${idx++}`);
      values.push(rt);
    }
    if (point_cost !== undefined) {
      const cost = parseInt(point_cost, 10);
      if (Number.isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'point_cost must be positive' });
      updates.push(`point_cost = $${idx++}`);
      values.push(cost);
    }
    if (value !== undefined) {
      const valueNum = value === null || value === '' ? null : parseFloat(value);
      if (value !== null && value !== '' && (Number.isNaN(valueNum) || valueNum < 0)) {
        return res.status(400).json({ error: 'value must be a non-negative number' });
      }
      updates.push(`value = $${idx++}`);
      values.push(valueNum);
    }
    if (product_id !== undefined) {
      const productId = product_id === null || product_id === '' ? null : parseInt(product_id, 10);
      if (product_id !== null && product_id !== '' && Number.isNaN(productId)) {
        return res.status(400).json({ error: 'product_id must be an integer' });
      }
      updates.push(`product_id = $${idx++}`);
      values.push(productId);
    }
    if (min_purchase_amount !== undefined) {
      const minPurchase = min_purchase_amount === null || min_purchase_amount === '' ? null : parseFloat(min_purchase_amount);
      if (min_purchase_amount !== null && min_purchase_amount !== '' && (Number.isNaN(minPurchase) || minPurchase < 0)) {
        return res.status(400).json({ error: 'min_purchase_amount must be >= 0' });
      }
      updates.push(`min_purchase_amount = $${idx++}`);
      values.push(minPurchase);
    }
    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = $${idx++}`);
    values.push(new Date());
    values.push(id);
    const result = await db.pool.query(
      `UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, title, reward_type, point_cost, value, product_id, min_purchase_amount, is_active, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' });
    const row = result.rows[0];
    const out = rowToOffering({ ...row, product_title: null });
    return res.json({ reward_offering: out });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/reward-offerings/:id – delete (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
