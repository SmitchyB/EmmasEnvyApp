const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const INVOICES_TABLE = 'emmasenvy.invoices';
const INVOICE_ITEMS_TABLE = 'emmasenvy.invoice_items';
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings';

// GET /api/me/rewards – points and reward redemption history (invoices where user spent points)
router.get('/rewards', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const pointsRow = await db.pool.query(
      'SELECT COALESCE(reward_points, 0) AS reward_points FROM emmasenvy.users WHERE id = $1',
      [userId]
    );
    const points = pointsRow.rows[0]?.reward_points != null ? parseInt(pointsRow.rows[0].reward_points, 10) : 0;
    const historyResult = await db.pool.query(
      `SELECT i.invoice_id, i.created_at, i.reward_points_used,
              r.title AS reward_title
       FROM ${INVOICES_TABLE} i
       LEFT JOIN ${REWARD_OFFERINGS_TABLE} r ON r.id = i.reward_offering_id
       WHERE i.customer_id = $1 AND (i.reward_points_used IS NOT NULL AND i.reward_points_used > 0)
       ORDER BY i.created_at DESC`,
      [userId]
    );
    const reward_history = historyResult.rows.map((row) => ({
      invoice_id: row.invoice_id,
      created_at: row.created_at,
      points_used: row.reward_points_used != null ? parseInt(row.reward_points_used, 10) : 0,
      reward_title: row.reward_title || 'Reward',
    }));
    res.json({ points, reward_history });
  } catch (err) {
    console.error('[meInvoices] GET /rewards error', err);
    return next(err);
  }
});

// GET /api/me/invoices – list invoices for the current user (customer_id = req.user.id)
router.get('/invoices', requireAuth, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT id, invoice_id, created_at, total_amount, currency, payment_status, ship_order
       FROM ${INVOICES_TABLE}
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    const invoices = result.rows.map((row) => ({
      id: row.id,
      invoice_id: row.invoice_id,
      created_at: row.created_at,
      total_amount: Number(row.total_amount),
      currency: row.currency ?? 'USD',
      payment_status: row.payment_status,
      ship_order: Boolean(row.ship_order),
    }));
    res.json({ invoices });
  } catch (err) {
    console.error('[meInvoices] GET /invoices error', err);
    return next(err);
  }
});

// GET /api/me/invoices/:id – single invoice with items, only if owned by current user
router.get('/invoices/:id', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid invoice id' });
  }
  try {
    const invResult = await db.pool.query(
      `SELECT id, invoice_id, name, email, phone, total_amount, currency,
              payment_status, payment_method, status, created_at, updated_at
       FROM ${INVOICES_TABLE}
       WHERE id = $1 AND customer_id = $2`,
      [id, req.user.id]
    );
    const row = invResult.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const itemsResult = await db.pool.query(
      `SELECT id, item_id, item_type, title, price, quantity, image, selected_variant
       FROM ${INVOICE_ITEMS_TABLE} WHERE invoice_id = $1 ORDER BY id`,
      [id]
    );
    const items = itemsResult.rows.map((r) => ({
      id: r.id,
      item_id: r.item_id,
      item_type: r.item_type,
      title: r.title,
      price: Number(r.price),
      quantity: r.quantity,
      image: r.image,
      selected_variant: r.selected_variant,
    }));
    res.json({
      invoice: {
        id: row.id,
        invoice_id: row.invoice_id,
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
        total_amount: Number(row.total_amount),
        currency: row.currency ?? 'USD',
        payment_status: row.payment_status,
        payment_method: row.payment_method ?? null,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items,
      },
    });
  } catch (err) {
    console.error('[meInvoices] GET /invoices/:id error', err);
    return next(err);
  }
});

module.exports = router;
