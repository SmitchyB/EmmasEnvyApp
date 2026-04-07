/**
 * Reward offerings: admin / IT CRUD + public list for redemption at payment time.
 * GET /api/reward-offerings – list all (admin / IT)
 * GET /api/reward-offerings/available – active offerings, optional ?points= & ?subtotal= & ?service_type_id=
 * GET /api/reward-offerings/:id – get one (admin / IT)
 * POST /api/reward-offerings – create (admin / IT)
 * PATCH /api/reward-offerings/:id – update (admin / IT)
 * DELETE /api/reward-offerings/:id – delete (admin / IT)
 */

const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdminOrIT } = require('../middleware/auth');

const router = express.Router();
const TABLE = 'emmasenvy.reward_offerings';
const USERS_TABLE = 'emmasenvy.users';
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type';

const REWARD_TYPES = ['percent_off', 'dollar_off', 'free_service'];

const ACTIVE_TYPES_SQL = `r.reward_type IN ('percent_off', 'dollar_off', 'free_service')`;

const SELECT_OFFERING_SQL = `r.id, r.title, r.reward_type, r.point_cost, r.value, r.min_purchase_amount, r.is_active, r.service_type_id, r.created_at, r.updated_at`;

async function assertServiceTypeExists(serviceTypeId) {
  if (serviceTypeId == null) return;
  const r = await db.pool.query(`SELECT 1 FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`, [serviceTypeId]);
  if (r.rows.length === 0) {
    const err = new Error('service_type_id does not exist');
    err.statusCode = 400;
    throw err;
  }
}

/** Validation error message or null if ok */
function offeringValidationError(rewardType, valueNum, serviceTypeId) {
  if (rewardType === 'free_service') {
    if (serviceTypeId == null) return 'free_service requires service_type_id';
    return null;
  }
  if (rewardType === 'percent_off' || rewardType === 'dollar_off') {
    if (valueNum == null || Number.isNaN(valueNum) || valueNum <= 0) {
      return 'value is required and must be positive for percent_off and dollar_off';
    }
    if (rewardType === 'percent_off' && valueNum > 100) return 'value cannot exceed 100 for percent_off';
  }
  return null;
}


function rowToOffering(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    reward_type: row.reward_type,
    point_cost: row.point_cost != null ? parseInt(row.point_cost, 10) : 0,
    value: row.value != null ? Number(row.value) : null,
    min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : null,
    is_active: row.is_active === true,
    service_type_id: row.service_type_id != null ? Number(row.service_type_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function filterByServiceType(list, serviceTypeId) {
  if (serviceTypeId == null || Number.isNaN(serviceTypeId)) return list;
  return list.filter((o) => o.service_type_id == null || o.service_type_id === serviceTypeId);
}

// GET /api/reward-offerings/customer-eligible?customerId=&subtotal=&service_type_id=
router.get('/customer-eligible', requireAuth, async (req, res, next) => {
  try {
    const customerId = req.query.customerId != null ? parseInt(req.query.customerId, 10) : null;
    const subtotal = req.query.subtotal != null ? parseFloat(req.query.subtotal) : null;
    const serviceTypeId = req.query.service_type_id != null ? parseInt(req.query.service_type_id, 10) : null;
    if (customerId == null || Number.isNaN(customerId)) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    const userRow = await db.pool.query(
      `SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`,
      [customerId]
    );
    const points = userRow.rows[0]?.reward_points != null ? parseInt(userRow.rows[0].reward_points, 10) : 0;
    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
       FROM ${TABLE} r
       WHERE r.is_active = true AND ${ACTIVE_TYPES_SQL} AND r.point_cost <= $1
       ORDER BY r.point_cost ASC, r.id ASC`,
      [points]
    );
    let list = result.rows.map(rowToOffering);
    if (subtotal != null && !Number.isNaN(subtotal)) {
      list = list.filter((o) => o.min_purchase_amount == null || o.min_purchase_amount <= subtotal);
    }
    list = filterByServiceType(list, serviceTypeId);
    return res.json({ points, reward_offerings: list });
  } catch (err) {
    console.error('[rewardOfferings] GET /customer-eligible error', err);
    return next(err);
  }
});

// GET /api/reward-offerings/available – active offerings; ?points= & ?subtotal= & ?service_type_id=
router.get('/available', async (req, res, next) => {
  try {
    const points = req.query.points != null ? parseInt(req.query.points, 10) : null;
    const subtotal = req.query.subtotal != null ? parseFloat(req.query.subtotal) : null;
    const serviceTypeId = req.query.service_type_id != null ? parseInt(req.query.service_type_id, 10) : null;

    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
       FROM ${TABLE} r
       WHERE r.is_active = true AND ${ACTIVE_TYPES_SQL}
       ORDER BY r.point_cost ASC, r.id ASC`
    );
    let list = result.rows.map(rowToOffering);
    if (points != null && !Number.isNaN(points)) {
      list = list.filter((o) => o.point_cost <= points);
    }
    if (subtotal != null && !Number.isNaN(subtotal)) {
      list = list.filter((o) => o.min_purchase_amount == null || o.min_purchase_amount <= subtotal);
    }
    list = filterByServiceType(list, serviceTypeId);
    return res.json({ reward_offerings: list });
  } catch (err) {
    console.error('[rewardOfferings] GET /available error', err);
    return next(err);
  }
});

// GET /api/reward-offerings – list all (admin / IT)
router.get('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
       FROM ${TABLE} r
       ORDER BY r.created_at DESC, r.id DESC`
    );
    const reward_offerings = result.rows.map(rowToOffering);
    return res.json({ reward_offerings });
  } catch (err) {
    return next(err);
  }
});

// GET /api/reward-offerings/:id – get one (admin / IT)
router.get('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
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

// POST /api/reward-offerings – create (admin / IT)
router.post('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const { title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id } = req.body;
    const titleStr = (title && String(title).trim()) || '';
    if (!titleStr) return res.status(400).json({ error: 'title is required' });
    const rt = (reward_type && String(reward_type).trim()) || '';
    if (!REWARD_TYPES.includes(rt)) {
      return res.status(400).json({ error: 'reward_type must be percent_off, dollar_off, or free_service' });
    }
    const cost = parseInt(point_cost, 10);
    if (Number.isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'point_cost must be a positive integer' });

    let serviceTypeIdParsed =
      service_type_id !== undefined && service_type_id !== null && service_type_id !== ''
        ? parseInt(service_type_id, 10)
        : null;
    if (service_type_id !== undefined && service_type_id !== null && service_type_id !== '' && Number.isNaN(serviceTypeIdParsed)) {
      return res.status(400).json({ error: 'Invalid service_type_id' });
    }

    let valueNum = null;
    if (rt === 'percent_off' || rt === 'dollar_off') {
      valueNum = value != null && value !== '' ? parseFloat(value) : null;
    } else if (rt === 'free_service') {
      if (value != null && value !== '') {
        valueNum = parseFloat(value);
        if (Number.isNaN(valueNum) || valueNum < 0) {
          return res.status(400).json({ error: 'value must be non-negative for free_service if set' });
        }
      }
    }

    const offerErr = offeringValidationError(rt, valueNum, serviceTypeIdParsed);
    if (offerErr) return res.status(400).json({ error: offerErr });

    await assertServiceTypeExists(serviceTypeIdParsed);

    const minPurchase = min_purchase_amount != null && min_purchase_amount !== '' ? parseFloat(min_purchase_amount) : null;
    if (min_purchase_amount != null && min_purchase_amount !== '' && (Number.isNaN(minPurchase) || minPurchase < 0)) {
      return res.status(400).json({ error: 'min_purchase_amount must be 0 or greater' });
    }
    const active = is_active !== false;
    const now = new Date();

    const result = await db.pool.query(
      `INSERT INTO ${TABLE} (title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at`,
      [titleStr, rt, cost, valueNum, minPurchase, active, serviceTypeIdParsed, now]
    );
    const row = result.rows[0];
    return res.status(201).json({ reward_offering: rowToOffering(row) });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[rewardOfferings] POST / error', err);
    return next(err);
  }
});

// PATCH /api/reward-offerings/:id – update (admin / IT)
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.pool.query(
      `SELECT id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id
       FROM ${TABLE} WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' });
    const cur = existing.rows[0];

    const { title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id } = req.body;

    let mergedType = reward_type !== undefined ? String(reward_type).trim() : String(cur.reward_type).trim();
    if (reward_type !== undefined && !REWARD_TYPES.includes(mergedType)) {
      return res.status(400).json({ error: 'Invalid reward_type' });
    }

    let mergedValue =
      value !== undefined
        ? value === null || value === ''
          ? null
          : parseFloat(value)
        : cur.value != null
          ? Number(cur.value)
          : null;
    if (value !== undefined && value !== null && value !== '' && Number.isNaN(mergedValue)) {
      return res.status(400).json({ error: 'value must be a number' });
    }

    let mergedServiceTypeId =
      service_type_id !== undefined
        ? service_type_id === null || service_type_id === ''
          ? null
          : parseInt(service_type_id, 10)
        : cur.service_type_id != null
          ? parseInt(cur.service_type_id, 10)
          : null;
    if (service_type_id !== undefined && service_type_id !== null && service_type_id !== '' && Number.isNaN(mergedServiceTypeId)) {
      return res.status(400).json({ error: 'Invalid service_type_id' });
    }

    const offerErr = offeringValidationError(mergedType, mergedValue, mergedServiceTypeId);
    if (offerErr) return res.status(400).json({ error: offerErr });
    await assertServiceTypeExists(mergedServiceTypeId);

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
      updates.push(`reward_type = $${idx++}`);
      values.push(mergedType);
    }
    if (point_cost !== undefined) {
      const cost = parseInt(point_cost, 10);
      if (Number.isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'point_cost must be positive' });
      updates.push(`point_cost = $${idx++}`);
      values.push(cost);
    }
    if (value !== undefined) {
      updates.push(`value = $${idx++}`);
      values.push(mergedValue);
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
    if (service_type_id !== undefined) {
      updates.push(`service_type_id = $${idx++}`);
      values.push(mergedServiceTypeId);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = $${idx++}`);
    values.push(new Date());
    values.push(id);
    const result = await db.pool.query(
      `UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' });
    return res.json({ reward_offering: rowToOffering(result.rows[0]) });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    return next(err);
  }
});

// DELETE /api/reward-offerings/:id – delete (admin / IT)
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
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
