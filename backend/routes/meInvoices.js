const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module
const { requireAuth } = require('../middleware/auth'); // Import the requireAuth middleware

const router = express.Router(); // Create a router for /api/me/* invoice and reward routes
const INVOICES_TABLE = 'emmasenvy.invoices'; // Qualified invoices table name
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings'; // Join for reward titles on invoices

// GET /api/me/rewards – points and reward redemption history (invoices where user spent points)
router.get('/rewards', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id; // Authenticated user id
    const pointsRow = await db.pool.query(
      'SELECT COALESCE(reward_points, 0) AS reward_points FROM emmasenvy.users WHERE id = $1',
      [userId]
    );
    const points = pointsRow.rows[0]?.reward_points != null ? parseInt(pointsRow.rows[0].reward_points, 10) : 0; // Current balance as integer
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
      invoice_id: row.invoice_id, // Public invoice id string
      created_at: row.created_at, // When the redemption invoice was created
      points_used: row.reward_points_used != null ? parseInt(row.reward_points_used, 10) : 0, // Points debited on that invoice
      reward_title: row.reward_title || 'Reward', // Fallback label if offering title missing
    }));
    res.json({ points, reward_history }); // Balance plus redemption rows
  } catch (err) {
    console.error('[meInvoices] GET /rewards error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// GET /api/me/invoices – list invoices for the current user (customer_id = req.user.id)
router.get('/invoices', requireAuth, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT id, invoice_id, created_at, total_amount, currency, payment_status, appointment_id, service_title
       FROM ${INVOICES_TABLE}
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    const invoices = result.rows.map((row) => ({
      id: row.id, // Internal invoice primary key
      invoice_id: row.invoice_id, // Human-readable invoice id
      created_at: row.created_at, // Creation timestamp
      total_amount: Number(row.total_amount), // Total as number for JSON
      currency: row.currency ?? 'USD', // Default currency if null
      payment_status: row.payment_status, // e.g. Pending, Paid, Canceled
      appointment_id: row.appointment_id ?? null, // Linked appointment if any
      service_title: row.service_title ?? null, // Service line label from booking
    }));
    res.json({ invoices }); // List for account / invoices UI
  } catch (err) {
    console.error('[meInvoices] GET /invoices error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// GET /api/me/invoices/:id – single invoice (line detail from service_title on invoice row)
router.get('/invoices/:id', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10); // Invoice id from URL
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid invoice id' }); // Reject non-numeric id
  }
  try {
    const invResult = await db.pool.query(
      `SELECT id, invoice_id, name, email, phone, total_amount, currency,
              payment_status, payment_method, created_at, updated_at, appointment_id, service_title
       FROM ${INVOICES_TABLE}
       WHERE id = $1 AND customer_id = $2`,
      [id, req.user.id]
    );
    const row = invResult.rows[0]; // Invoice row scoped to current user
    if (!row) {
      return res.status(404).json({ error: 'Invoice not found' }); // No row or wrong customer
    }
    const serviceLabel = row.service_title && String(row.service_title).trim(); // Non-empty service title if present
    const hasLine = row.appointment_id != null || Boolean(serviceLabel); // Whether to synthesize a single line item
    const items = hasLine
      ? [
          {
            id: 0, // Synthetic line id (no separate line-items table)
            item_id: row.appointment_id, // Tie line to appointment when set
            item_type: 'Appointment', // Discriminator for UI
            title: serviceLabel || 'Service', // Display name for the line
            price: Number(row.total_amount), // Line price equals invoice total for single-line invoices
            quantity: 1, // Single service line
            image: null,
            selected_variant: null, // Not used for appointments
          },
        ]
      : [];
    res.json({
      invoice: {
        id: row.id, // Internal id
        invoice_id: row.invoice_id, // Display id
        name: row.name, // Customer name snapshot
        email: row.email ?? null, // Email on invoice
        phone: row.phone ?? null, // Phone on invoice
        total_amount: Number(row.total_amount), // Total as number
        currency: row.currency ?? 'USD', // Currency code
        payment_status: row.payment_status, // Payment state
        payment_method: row.payment_method ?? null, // How paid or pending method
        appointment_id: row.appointment_id ?? null, // Link back to appointment
        service_title: row.service_title ?? null, // Raw service title field
        created_at: row.created_at, // Created
        updated_at: row.updated_at, // Last update
        items, // Synthetic line array for detail view
      },
    });
  } catch (err) {
    console.error('[meInvoices] GET /invoices/:id error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

module.exports = router; // Export Express router for app mounting
