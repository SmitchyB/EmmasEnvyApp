const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const TICKETS_TABLE = 'emmasenvy.support_tickets';
const MESSAGES_TABLE = 'emmasenvy.ticket_messages';
const USERS_TABLE = 'emmasenvy.users';
const INVOICES_TABLE = 'emmasenvy.invoices';

const ALLOWED_STATUSES = ['open', 'in_progress', 'closed'];

// GET /api/support-tickets – list tickets (admin only), optional ?status=
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    const hasStatusFilter = statusFilter && ALLOWED_STATUSES.includes(statusFilter);

    const result = await db.pool.query(
      `SELECT t.id, t.user_id, t.invoice_id, t.subject, t.issue_description, t.status,
              t.photo_locations, t.created_at, t.updated_at,
              u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email,
              i.invoice_id AS invoice_display_id
       FROM ${TICKETS_TABLE} t
       JOIN ${USERS_TABLE} u ON u.id = t.user_id
       LEFT JOIN ${INVOICES_TABLE} i ON i.id = t.invoice_id
       ${hasStatusFilter ? 'WHERE t.status = $1' : ''}
       ORDER BY t.updated_at DESC, t.created_at DESC`,
      hasStatusFilter ? [statusFilter] : []
    );

    const tickets = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      invoice_id: row.invoice_id,
      invoice_display_id: row.invoice_display_id ?? null,
      subject: row.subject,
      issue_description: row.issue_description,
      status: row.status ?? 'open',
      photo_locations: Array.isArray(row.photo_locations) ? row.photo_locations : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        first_name: row.user_first_name,
        last_name: row.user_last_name,
        email: row.user_email,
      },
    }));

    res.json({ tickets });
  } catch (err) {
    console.error('[SupportTickets] GET / error', err);
    return next(err);
  }
});

// GET /api/support-tickets/:id – single ticket with messages (admin only)
router.get('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }
  try {
    const ticketResult = await db.pool.query(
      `SELECT t.id, t.user_id, t.invoice_id, t.subject, t.issue_description, t.status,
              t.photo_locations, t.created_at, t.updated_at,
              u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email,
              i.invoice_id AS invoice_display_id
       FROM ${TICKETS_TABLE} t
       JOIN ${USERS_TABLE} u ON u.id = t.user_id
       LEFT JOIN ${INVOICES_TABLE} i ON i.id = t.invoice_id
       WHERE t.id = $1`,
      [id]
    );
    const row = ticketResult.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const messagesResult = await db.pool.query(
      `SELECT m.id, m.ticket_id, m.sender_id, m.message, m.created_at,
              u.first_name AS sender_first_name, u.last_name AS sender_last_name, u.email AS sender_email
       FROM ${MESSAGES_TABLE} m
       JOIN ${USERS_TABLE} u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );

    const ticket = {
      id: row.id,
      user_id: row.user_id,
      invoice_id: row.invoice_id,
      invoice_display_id: row.invoice_display_id ?? null,
      subject: row.subject,
      issue_description: row.issue_description,
      status: row.status ?? 'open',
      photo_locations: Array.isArray(row.photo_locations) ? row.photo_locations : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        first_name: row.user_first_name,
        last_name: row.user_last_name,
        email: row.user_email,
      },
      messages: messagesResult.rows.map((m) => ({
        id: m.id,
        ticket_id: m.ticket_id,
        sender_id: m.sender_id,
        message: m.message,
        created_at: m.created_at,
        sender: {
          id: m.sender_id,
          first_name: m.sender_first_name,
          last_name: m.sender_last_name,
          email: m.sender_email,
        },
      })),
    };

    res.json({ ticket });
  } catch (err) {
    console.error('[SupportTickets] GET /:id error', err);
    return next(err);
  }
});

// PATCH /api/support-tickets/:id – update status (admin only)
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }
  const { status } = req.body || {};
  const newStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return res.status(400).json({
      error: 'status must be one of: ' + ALLOWED_STATUSES.join(', '),
    });
  }
  try {
    const result = await db.pool.query(
      `UPDATE ${TICKETS_TABLE} SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
      [newStatus, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ status: result.rows[0].status });
  } catch (err) {
    console.error('[SupportTickets] PATCH /:id error', err);
    return next(err);
  }
});

// POST /api/support-tickets/:id/messages – add a message (admin only)
router.post('/:id/messages', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }
  const { message } = req.body || {};
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'message is required' });
  }
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const ticketCheck = await db.pool.query(
      `SELECT id FROM ${TICKETS_TABLE} WHERE id = $1`,
      [id]
    );
    if (!ticketCheck.rows[0]) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const insertResult = await db.pool.query(
      `INSERT INTO ${MESSAGES_TABLE} (ticket_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, ticket_id, sender_id, message, created_at`,
      [id, userId, text]
    );
    const row = insertResult.rows[0];

    await db.pool.query(
      `UPDATE ${TICKETS_TABLE} SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    const sender = req.user;
    res.status(201).json({
      message: {
        id: row.id,
        ticket_id: row.ticket_id,
        sender_id: row.sender_id,
        message: row.message,
        created_at: row.created_at,
        sender: {
          id: sender.id,
          first_name: sender.first_name,
          last_name: sender.last_name,
          email: sender.email,
        },
      },
    });
  } catch (err) {
    console.error('[SupportTickets] POST /:id/messages error', err);
    return next(err);
  }
});

module.exports = router;
