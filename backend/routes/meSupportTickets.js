const path = require('path');
const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { supportPhotoUpload } = require('../lib/upload');

const router = express.Router();
const TICKETS_TABLE = 'emmasenvy.support_tickets';
const MESSAGES_TABLE = 'emmasenvy.ticket_messages';
const USERS_TABLE = 'emmasenvy.users';
const INVOICES_TABLE = 'emmasenvy.invoices';

// GET /api/me/support-tickets – list tickets for current user, optional ?invoice_id=
router.get('/support-tickets', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const invoiceIdParam = req.query.invoice_id;
    const invoiceId = typeof invoiceIdParam === 'string' && invoiceIdParam.trim() ? parseInt(invoiceIdParam.trim(), 10) : null;
    const hasInvoiceFilter = invoiceId != null && !Number.isNaN(invoiceId);

    const result = await db.pool.query(
      `SELECT t.id, t.user_id, t.invoice_id, t.subject, t.issue_description, t.status,
              t.photo_locations, t.created_at, t.updated_at,
              u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email,
              i.invoice_id AS invoice_display_id
       FROM ${TICKETS_TABLE} t
       JOIN ${USERS_TABLE} u ON u.id = t.user_id
       LEFT JOIN ${INVOICES_TABLE} i ON i.id = t.invoice_id
       WHERE t.user_id = $1 ${hasInvoiceFilter ? 'AND t.invoice_id = $2' : ''}
       ORDER BY t.updated_at DESC, t.created_at DESC`,
      hasInvoiceFilter ? [userId, invoiceId] : [userId]
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
    console.error('[meSupportTickets] GET /support-tickets error', err);
    return next(err);
  }
});

// POST /api/me/support-tickets – create ticket (customer)
router.post('/support-tickets', requireAuth, async (req, res, next) => {
  const userId = req.user.id;
  const { subject, issue_description, invoice_id: bodyInvoiceId, photo_locations: bodyPhotoLocations } = req.body || {};
  const subjectStr = typeof subject === 'string' ? subject.trim() : '';
  const descriptionStr = typeof issue_description === 'string' ? issue_description.trim() : '';
  if (!subjectStr) {
    return res.status(400).json({ error: 'subject is required' });
  }
  if (!descriptionStr) {
    return res.status(400).json({ error: 'issue_description is required' });
  }

  let invoiceId = null;
  if (bodyInvoiceId != null && bodyInvoiceId !== '') {
    const parsed = parseInt(bodyInvoiceId, 10);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ error: 'Invalid invoice_id' });
    }
    invoiceId = parsed;
  }

  const photoLocations = Array.isArray(bodyPhotoLocations)
    ? bodyPhotoLocations.filter((p) => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
    : [];

  try {
    if (invoiceId != null) {
      const invCheck = await db.pool.query(
        `SELECT id FROM ${INVOICES_TABLE} WHERE id = $1 AND customer_id = $2`,
        [invoiceId, userId]
      );
      if (!invCheck.rows[0]) {
        return res.status(400).json({ error: 'Invoice not found or not yours' });
      }
    }

    const insertResult = await db.pool.query(
      `INSERT INTO ${TICKETS_TABLE} (user_id, invoice_id, subject, issue_description, status, photo_locations)
       VALUES ($1, $2, $3, $4, 'open', $5::text[])
       RETURNING id, user_id, invoice_id, subject, issue_description, status, photo_locations, created_at, updated_at`,
      [userId, invoiceId, subjectStr, descriptionStr, photoLocations]
    );
    const row = insertResult.rows[0];

    let invoice_display_id = null;
    if (row.invoice_id) {
      const invRow = await db.pool.query(
        `SELECT invoice_id FROM ${INVOICES_TABLE} WHERE id = $1`,
        [row.invoice_id]
      );
      invoice_display_id = invRow.rows[0]?.invoice_id ?? null;
    }

    res.status(201).json({
      ticket: {
        id: row.id,
        user_id: row.user_id,
        invoice_id: row.invoice_id,
        invoice_display_id,
        subject: row.subject,
        issue_description: row.issue_description,
        status: row.status ?? 'open',
        photo_locations: Array.isArray(row.photo_locations) ? row.photo_locations : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: req.user.id,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          email: req.user.email,
        },
        messages: [],
      },
    });
  } catch (err) {
    console.error('[meSupportTickets] POST /support-tickets error', err);
    return next(err);
  }
});

// POST /api/me/support-tickets/upload – upload photos for a new ticket (store in uploads/support)
router.post('/support-tickets/upload', requireAuth, supportPhotoUpload.array('photos', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No photos uploaded' });
  }
  const paths = req.files.map((f) => `support/${f.filename}`);
  res.status(201).json({ paths });
});

// GET /api/me/support-tickets/:id – single ticket with messages (own only)
router.get('/support-tickets/:id', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }
  const userId = req.user.id;
  try {
    const ticketResult = await db.pool.query(
      `SELECT t.id, t.user_id, t.invoice_id, t.subject, t.issue_description, t.status,
              t.photo_locations, t.created_at, t.updated_at,
              u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email,
              i.invoice_id AS invoice_display_id
       FROM ${TICKETS_TABLE} t
       JOIN ${USERS_TABLE} u ON u.id = t.user_id
       LEFT JOIN ${INVOICES_TABLE} i ON i.id = t.invoice_id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
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
    console.error('[meSupportTickets] GET /support-tickets/:id error', err);
    return next(err);
  }
});

// POST /api/me/support-tickets/:id/messages – add message (own ticket only)
router.post('/support-tickets/:id/messages', requireAuth, async (req, res, next) => {
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
      `SELECT id FROM ${TICKETS_TABLE} WHERE id = $1 AND user_id = $2`,
      [id, userId]
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
    console.error('[meSupportTickets] POST /support-tickets/:id/messages error', err);
    return next(err);
  }
});

module.exports = router;
