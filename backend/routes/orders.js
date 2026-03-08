const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const INVOICES_TABLE = 'emmasenvy.invoices';
const INVOICE_ITEMS_TABLE = 'emmasenvy.invoice_items';
const USER_ADDRESSES_TABLE = 'emmasenvy.user_addresses';

const SHIPPING_STATUSES = ['pending', 'ready_to_ship', 'shipped', 'complete'];

function rowToAddress(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2 ?? null,
    city: row.city,
    state_province: row.state_province,
    zip_postal_code: row.zip_postal_code,
    country: row.country ?? 'USA',
    phone: row.phone_number ?? null,
  };
}

// GET /api/orders – list invoices where ship_order = true (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT i.id, i.invoice_id, i.name, i.email, i.phone, i.total_amount, i.currency,
              i.payment_status, i.shipping_status, i.created_at, i.address_id,
              a.full_name AS addr_full_name, a.address_line_1 AS addr_line_1, a.address_line_2 AS addr_line_2,
              a.city AS addr_city, a.state_province AS addr_state, a.zip_postal_code AS addr_zip,
              a.country AS addr_country, a.phone_number AS addr_phone
       FROM ${INVOICES_TABLE} i
       LEFT JOIN ${USER_ADDRESSES_TABLE} a ON a.id = i.address_id
       WHERE i.ship_order = true
       ORDER BY i.created_at DESC`
    );
    const itemsResult = await db.pool.query(
      `SELECT invoice_id, title, price, quantity, item_type
       FROM ${INVOICE_ITEMS_TABLE}
       WHERE invoice_id = ANY($1::int[])
       ORDER BY invoice_id`,
      [result.rows.map((r) => r.id)]
    );
    const itemsByInvoiceId = {};
    for (const row of itemsResult.rows) {
      if (!itemsByInvoiceId[row.invoice_id]) itemsByInvoiceId[row.invoice_id] = [];
      itemsByInvoiceId[row.invoice_id].push({
        title: row.title,
        price: Number(row.price),
        quantity: row.quantity,
        item_type: row.item_type,
      });
    }
    const orders = result.rows.map((row) => {
      const address = row.address_id
        ? {
            full_name: row.addr_full_name,
            address_line_1: row.addr_line_1,
            address_line_2: row.addr_line_2,
            city: row.addr_city,
            state_province: row.addr_state,
            zip_postal_code: row.addr_zip,
            country: row.addr_country,
            phone: row.addr_phone,
          }
        : null;
      const oneLine = address
        ? [address.full_name, address.address_line_1, address.address_line_2, [address.city, address.state_province, address.zip_postal_code].filter(Boolean).join(', ')].filter(Boolean).join(', ')
        : null;
      return {
        id: row.id,
        invoice_id: row.invoice_id,
        name: row.name,
        email: row.email,
        phone: row.phone ?? null,
        total_amount: Number(row.total_amount),
        currency: row.currency ?? 'USD',
        payment_status: row.payment_status,
        shipping_status: row.shipping_status ?? 'pending',
        created_at: row.created_at,
        address_id: row.address_id,
        shipping_address: oneLine,
        shipping_address_full: address,
        items: itemsByInvoiceId[row.id] || [],
      };
    });
    res.json({ orders });
  } catch (err) {
    console.error('[Orders] GET / error', err);
    return next(err);
  }
});

// GET /api/orders/:id – single order by invoices.id (admin only)
router.get('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  try {
    const invResult = await db.pool.query(
      `SELECT i.id, i.invoice_id, i.name, i.email, i.phone, i.total_amount, i.currency,
              i.payment_status, i.shipping_status, i.created_at, i.updated_at, i.address_id
       FROM ${INVOICES_TABLE} i
       WHERE i.id = $1 AND i.ship_order = true`,
      [id]
    );
    const row = invResult.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Order not found' });
    }
    let address = null;
    if (row.address_id) {
      const addrResult = await db.pool.query(
        `SELECT id, full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone_number
         FROM ${USER_ADDRESSES_TABLE} WHERE id = $1`,
        [row.address_id]
      );
      address = addrResult.rows[0] ? rowToAddress(addrResult.rows[0]) : null;
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
      order: {
        id: row.id,
        invoice_id: row.invoice_id,
        name: row.name,
        email: row.email,
        phone: row.phone ?? null,
        total_amount: Number(row.total_amount),
        currency: row.currency ?? 'USD',
        payment_status: row.payment_status,
        shipping_status: row.shipping_status ?? 'pending',
        created_at: row.created_at,
        updated_at: row.updated_at,
        address_id: row.address_id,
        shipping_address: address,
        items,
      },
    });
  } catch (err) {
    console.error('[Orders] GET /:id error', err);
    return next(err);
  }
});

// PATCH /api/orders/:id – update shipping_status only (admin only)
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  const { shipping_status } = req.body || {};
  const status = typeof shipping_status === 'string' ? shipping_status.trim().toLowerCase() : '';
  if (!SHIPPING_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'shipping_status must be one of: ' + SHIPPING_STATUSES.join(', '),
    });
  }
  try {
    const result = await db.pool.query(
      `UPDATE ${INVOICES_TABLE} SET shipping_status = $1, updated_at = NOW() WHERE id = $2 AND ship_order = true RETURNING id`,
      [status, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ shipping_status: status });
  } catch (err) {
    console.error('[Orders] PATCH /:id error', err);
    return next(err);
  }
});

module.exports = router;
