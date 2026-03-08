const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const { DEFAULT_CURRENCY } = require('../lib/constants');
const { finishedPhotoUpload } = require('../lib/upload');

const APPOINTMENTS_TABLE = 'emmasenvy.appointments';
const PORTFOLIO_PHOTOS_TABLE = 'emmasenvy.portfolio_photos';
const INVOICES_TABLE = 'emmasenvy.invoices';
const INVOICE_ITEMS_TABLE = 'emmasenvy.invoice_items';
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type';
const PORTFOLIOS_TABLE = 'emmasenvy.portfolios';

const DEFAULT_DAY_START = '08:00';
const DEFAULT_DAY_END = '18:00';
const SLOT_STEP_MINUTES = 15;
// Must match invoices_payment_method_check: 'cash' | 'card' | 'pending'. Pending = waiting until appointment.
const DEFAULT_PAYMENT_METHOD = process.env.DEFAULT_PAYMENT_METHOD || 'pending';
// Must match invoice_items_item_type_check. Run: SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'invoice_items_item_type_check';
// If it allows e.g. 'Appointment'/'Product', use that; else set INVOICE_ITEM_TYPE_APPOINTMENT in .env to the exact allowed value.
const INVOICE_ITEM_TYPE_APPOINTMENT = process.env.INVOICE_ITEM_TYPE_APPOINTMENT || 'Appointment';
// Must match appointments_status_check. Set STATUS_CANCELED in .env to override.
const STATUS_CANCELED = process.env.STATUS_CANCELED || 'Canceled';

function rowToAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_id: row.client_id ?? null,
    client_name: row.client_name ?? '',
    client_email: row.client_email ?? null,
    client_phone: row.client_phone ?? null,
    employee_id: row.employee_id ?? null,
    date: row.date ?? null,
    time: row.time ?? null,
    description: row.description ?? null,
    inspo_pics: Array.isArray(row.inspo_pics) ? row.inspo_pics : row.inspo_pics ?? null,
    status: row.status ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    duration: row.duration ?? null,
    invoice_id: row.invoice_id ?? null,
    service_type_id: row.service_type_id ?? null,
  };
}

/**
 * Parse "HH:MM:SS" or "HH:MM" or postgres interval object to total minutes.
 */
function durationToMinutes(duration) {
  if (duration == null) return 0;
  if (typeof duration === 'object' && (duration.hours != null || duration.minutes != null)) {
    const h = Math.floor(Number(duration.hours) || 0);
    const m = Math.floor(Number(duration.minutes) || 0);
    const s = Math.floor(Number(duration.seconds) || 0);
    const days = Math.floor(Number(duration.days) || 0);
    return (h + days * 24) * 60 + m + s / 60;
  }
  const str = String(duration).trim();
  const match = str.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0;
    return h * 60 + m + s / 60;
  }
  return 0;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const str = String(t).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    return h * 60 + m;
  }
  return 0;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Generate human-readable invoice_id: FirstInitialSecondInitialYYYYMMDD-N
 */
function generateInvoiceId(clientName, dateStr) {
  const name = (clientName || 'GU').trim().toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  const first = (parts[0] || 'G').charAt(0);
  const second = parts.length > 1 ? (parts[1].charAt(0)) : (parts[0].length > 1 ? parts[0].charAt(1) : 'U');
  const datePart = (dateStr || '').replace(/-/g, '').slice(0, 8) || '00000000';
  return `${first}${second}${datePart}`;
}

const router = express.Router();

// GET /api/appointments/availability – public or auth; query: date, service_type_id
router.get('/availability', optionalAuth, async (req, res, next) => {
  try {
    const date = req.query.date;
    const serviceTypeId = req.query.service_type_id ? parseInt(req.query.service_type_id, 10) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceTypeId || Number.isNaN(serviceTypeId)) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) and service_type_id are required' });
    }
    const stResult = await db.pool.query(
      `SELECT id, employee_id, duration_needed FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`,
      [serviceTypeId]
    );
    const st = stResult.rows[0];
    if (!st) return res.status(404).json({ error: 'Service type not found' });
    const employeeId = st.employee_id;
    if (employeeId == null) return res.status(400).json({ error: 'Service type has no assigned employee' });
    const durationMinutes = durationToMinutes(st.duration_needed);
    if (durationMinutes <= 0) return res.status(400).json({ error: 'Service type has no duration' });

    const startMin = timeToMinutes(DEFAULT_DAY_START);
    const endMin = timeToMinutes(DEFAULT_DAY_END);
    const existing = await db.pool.query(
      `SELECT time, duration FROM ${APPOINTMENTS_TABLE}
       WHERE employee_id = $1 AND date = $2 AND status IS DISTINCT FROM $3
       ORDER BY time`,
      [employeeId, date, STATUS_CANCELED]
    );
    const blocks = [];
    for (const row of existing.rows) {
      const t = timeToMinutes(row.time);
      let dur = durationToMinutes(row.duration);
      if (dur <= 0) dur = 60;
      blocks.push([t, t + dur]);
    }
    blocks.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [s, e] of blocks) {
      if (merged.length && s <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
      } else {
        merged.push([s, e]);
      }
    }
    const gaps = [];
    let prevEnd = startMin;
    for (const [s, e] of merged) {
      if (s > prevEnd) gaps.push([prevEnd, s]);
      prevEnd = Math.max(prevEnd, e);
    }
    if (prevEnd < endMin) gaps.push([prevEnd, endMin]);

    const slots = [];
    for (const [gapStart, gapEnd] of gaps) {
      const gapLen = gapEnd - gapStart;
      if (gapLen < durationMinutes) continue;
      for (let t = gapStart; t + durationMinutes <= gapEnd; t += SLOT_STEP_MINUTES) {
        slots.push(minutesToTime(t));
      }
    }
    res.json({ slots });
  } catch (err) {
    console.error('[Appointments] GET /availability error', err);
    return next(err);
  }
});

// GET /api/appointments – list (auth, admin sees all)
// Query: date_from, date_to, employee_id, status, exclude_paid_invoice (1/true = hide appointments whose invoice is paid)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user && String(req.user.role).toLowerCase() === 'admin';
    const { date_from, date_to, employee_id, status, exclude_paid_invoice } = req.query;
    const excludePaid = exclude_paid_invoice === '1' || String(exclude_paid_invoice).toLowerCase() === 'true';
    const tableAlias = 'a';
    let query = `SELECT ${tableAlias}.id, ${tableAlias}.client_id, ${tableAlias}.client_name, ${tableAlias}.client_email, ${tableAlias}.client_phone, ${tableAlias}.employee_id, ${tableAlias}.date, ${tableAlias}.time, ${tableAlias}.description, ${tableAlias}.inspo_pics, ${tableAlias}.status, ${tableAlias}.created_by, ${tableAlias}.created_at, ${tableAlias}.updated_at, ${tableAlias}.duration, ${tableAlias}.invoice_id, ${tableAlias}.service_type_id FROM ${APPOINTMENTS_TABLE} ${tableAlias}`;
    if (excludePaid) {
      query += ` LEFT JOIN ${INVOICES_TABLE} i ON i.id = ${tableAlias}.invoice_id`;
    }
    query += ` WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (!isAdmin) {
      query += ` AND ${tableAlias}.employee_id = $${idx++}`;
      params.push(req.user.id);
    }
    if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      query += ` AND ${tableAlias}.date >= $${idx++}`;
      params.push(date_from);
    }
    if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      query += ` AND ${tableAlias}.date <= $${idx++}`;
      params.push(date_to);
    }
    if (employee_id != null && employee_id !== '') {
      const eid = parseInt(employee_id, 10);
      if (!Number.isNaN(eid)) {
        query += ` AND ${tableAlias}.employee_id = $${idx++}`;
        params.push(eid);
      }
    }
    if (status && status !== '') {
      query += ` AND ${tableAlias}.status = $${idx++}`;
      params.push(String(status).trim());
    }
    if (excludePaid) {
      query += ` AND (i.id IS NULL OR i.payment_status IS DISTINCT FROM 'Paid')`;
    }
    query += ` ORDER BY ${tableAlias}.date ASC, ${tableAlias}.time ASC`;
    const result = await db.pool.query(query, params);
    res.json({ appointments: result.rows.map(rowToAppointment) });
  } catch (err) {
    console.error('[Appointments] GET / error', err);
    return next(err);
  }
});

// GET /api/appointments/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `SELECT id, client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, invoice_id, service_type_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Appointment not found' });
    const isAdmin = req.user && String(req.user.role).toLowerCase() === 'admin';
    if (!isAdmin && row.employee_id !== req.user.id && row.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(rowToAppointment(row));
  } catch (err) {
    console.error('[Appointments] GET /:id error', err);
    return next(err);
  }
});

// POST /api/appointments – create (optional auth; admin can set status Confirmed)
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
    const clientEmail = body.client_email != null ? String(body.client_email).trim() : null;
    const clientPhone = body.client_phone != null ? String(body.client_phone).trim() : null;
    if (!clientName) return res.status(400).json({ error: 'client_name is required' });
    if (!clientEmail && !clientPhone) return res.status(400).json({ error: 'At least one of client_email or client_phone is required' });
    const employeeId = body.employee_id != null ? parseInt(body.employee_id, 10) : null;
    const serviceTypeId = body.service_type_id != null ? parseInt(body.service_type_id, 10) : null;
    const date = typeof body.date === 'string' ? body.date.trim() : null;
    const time = typeof body.time === 'string' ? body.time.trim() : null;
    const description = body.description != null ? String(body.description).trim() : null;
    if (!employeeId || Number.isNaN(employeeId)) return res.status(400).json({ error: 'employee_id is required' });
    if (!serviceTypeId || Number.isNaN(serviceTypeId)) return res.status(400).json({ error: 'service_type_id is required' });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
    if (!time) return res.status(400).json({ error: 'time is required' });
    if (!description) return res.status(400).json({ error: 'description is required' });

    const isAdmin = req.user && String(req.user.role).toLowerCase() === 'admin';
    const status = isAdmin ? 'Confirmed' : 'Pending';
    const createdBy = req.user ? req.user.id : null;
    const clientId = body.client_id != null && body.client_id !== '' ? parseInt(body.client_id, 10) : null;
    const validClientId = Number.isNaN(clientId) ? null : clientId;
    let inspoPics = body.inspo_pics;
    if (inspoPics != null && !Array.isArray(inspoPics)) inspoPics = [inspoPics];
    if (inspoPics != null && inspoPics.length === 0) inspoPics = null;

    const stResult = await db.pool.query(
      `SELECT id, employee_id, title, duration_needed, price FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`,
      [serviceTypeId]
    );
    const st = stResult.rows[0];
    if (!st) return res.status(404).json({ error: 'Service type not found' });
    if (st.employee_id !== employeeId) return res.status(400).json({ error: 'Service type does not belong to this employee' });
    const durationInterval = st.duration_needed;
    const price = st.price != null ? Number(st.price) : 0;
    const serviceTitle = st.title || 'Service';

    const client = await db.pool.connect();
    const run = (q, p) => client.query(q, p);
    const commit = () => client.release();
    const rollback = () => { client.query('ROLLBACK').catch(() => {}); client.release(); };

    try {
      await client.query('BEGIN');

      const now = new Date();
      const appResult = await run(
        `INSERT INTO ${APPOINTMENTS_TABLE} (
          client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, service_type_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13::interval, $14)
        RETURNING id, invoice_id`,
        [validClientId, clientName, clientEmail, clientPhone, employeeId, date, time, description, inspoPics, status, createdBy, now, durationInterval, serviceTypeId]
      );
      const appointment = appResult.rows[0];
      const appointmentId = appointment.id;

      const prefix = generateInvoiceId(clientName, date);
      const countResult = await run(
        `SELECT COUNT(*) AS c FROM ${INVOICES_TABLE} WHERE invoice_id LIKE $1`,
        [prefix + '%']
      );
      const n = (parseInt(countResult.rows[0].c, 10) || 0) + 1;
      const humanInvoiceId = `${prefix}-${n}`;

      const invResult = await run(
        `INSERT INTO ${INVOICES_TABLE} (
          invoice_id, customer_id, name, email, phone, created_by, total_amount, currency, payment_status, payment_method, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        RETURNING id`,
        [humanInvoiceId, validClientId, clientName, clientEmail || '', clientPhone || '', createdBy, price, DEFAULT_CURRENCY, 'Pending Appointment', DEFAULT_PAYMENT_METHOD, 'active', now]
      );
      const invoiceId = invResult.rows[0].id;

      await run(
        `INSERT INTO ${INVOICE_ITEMS_TABLE} (invoice_id, item_id, item_type, title, price, quantity, image, assigned_employee, selected_variant)
         VALUES ($1, $2, $3, $4, $5, 1, NULL, $6, NULL)`,
        [invoiceId, appointmentId, INVOICE_ITEM_TYPE_APPOINTMENT, serviceTitle, price, employeeId]
      );

      await run(
        `UPDATE ${APPOINTMENTS_TABLE} SET invoice_id = $1, updated_at = $2 WHERE id = $3`,
        [invoiceId, now, appointmentId]
      );

      await client.query('COMMIT');
      commit();

      const fullApp = await db.pool.query(
        `SELECT id, client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, invoice_id, service_type_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
        [appointmentId]
      );
      res.status(201).json(rowToAppointment(fullApp.rows[0]));
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[Appointments] POST / error', err);
    return next(err);
  }
});

// POST /api/appointments/:id/finished-photo – admin only; upload to portfolio_photos and set invoice_items.image
router.post(
  '/:id/finished-photo',
  requireAuth,
  requireAdmin,
  finishedPhotoUpload.single('photo'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      if (!req.file) return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' });
      const appResult = await db.pool.query(
        `SELECT id, employee_id, invoice_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
        [id]
      );
      const app = appResult.rows[0];
      if (!app) return res.status(404).json({ error: 'Appointment not found' });
      const portfolioResult = await db.pool.query(
        `SELECT id FROM ${PORTFOLIOS_TABLE} WHERE employee_id = $1`,
        [app.employee_id]
      );
      const portfolio = portfolioResult.rows[0];
      if (!portfolio) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(400).json({ error: 'No portfolio found for this appointment employee. Create a portfolio first.' });
      }
      const relativePath = path.join('portfolio', req.file.filename).split(path.sep).join('/');
      const now = new Date();
      const maxOrder = await db.pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1`,
        [portfolio.id]
      );
      const sortOrder = maxOrder.rows[0]?.next_order ?? 0;
      await db.pool.query(
        `INSERT INTO ${PORTFOLIO_PHOTOS_TABLE} (portfolio_id, url, caption, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [portfolio.id, relativePath, 'Finished appointment', sortOrder, now]
      );
      if (app.invoice_id != null) {
        await db.pool.query(
          `UPDATE ${INVOICE_ITEMS_TABLE} SET image = $1 WHERE invoice_id = $2 AND item_type = $3 AND item_id = $4`,
          [relativePath, app.invoice_id, INVOICE_ITEM_TYPE_APPOINTMENT, id]
        );
      }
      res.status(201).json({ photo: relativePath });
    } catch (err) {
      if (req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      console.error('[Appointments] POST /:id/finished-photo error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/appointments/:id – admin only
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body || {};
    const existing = await db.pool.query(
      `SELECT id, employee_id, service_type_id, date, time FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ error: 'Appointment not found' });

    const updates = [];
    const values = [];
    let idx = 1;
    const now = new Date();
    const set = (col, val) => { updates.push(`${col} = $${idx++}`); values.push(val); };
    if (body.client_name !== undefined) set('client_name', String(body.client_name).trim());
    if (body.client_email !== undefined) set('client_email', body.client_email == null ? null : String(body.client_email).trim());
    if (body.client_phone !== undefined) set('client_phone', body.client_phone == null ? null : String(body.client_phone).trim());
    if (body.client_id !== undefined) set('client_id', body.client_id == null || body.client_id === '' ? null : parseInt(body.client_id, 10));
    if (body.employee_id !== undefined) set('employee_id', parseInt(body.employee_id, 10));
    if (body.service_type_id !== undefined) set('service_type_id', parseInt(body.service_type_id, 10));
    if (body.date !== undefined) set('date', String(body.date).trim());
    if (body.time !== undefined) set('time', String(body.time).trim());
    if (body.description !== undefined) set('description', String(body.description).trim());
    if (body.status !== undefined) set('status', String(body.status).trim());
    if (body.inspo_pics !== undefined) set('inspo_pics', Array.isArray(body.inspo_pics) ? body.inspo_pics : null);
    if (updates.length === 0) {
      const sel = await db.pool.query(
        `SELECT id, client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, invoice_id, service_type_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
        [id]
      );
      return res.json(rowToAppointment(sel.rows[0]));
    }
    if (body.service_type_id !== undefined) {
      const stRes = await db.pool.query(
        `SELECT duration_needed FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`,
        [body.service_type_id]
      );
      if (stRes.rows[0]) updates.push(`duration = $${idx++}`), values.push(stRes.rows[0].duration_needed);
    }
    set('updated_at', now);
    values.push(id);
    await db.pool.query(
      `UPDATE ${APPOINTMENTS_TABLE} SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );
    const sel = await db.pool.query(
      `SELECT id, client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, invoice_id, service_type_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    res.json(rowToAppointment(sel.rows[0]));
  } catch (err) {
    console.error('[Appointments] PUT /:id error', err);
    return next(err);
  }
});

// PATCH /api/appointments/:id/cancel – admin only; set appointment and invoice to canceled (no delete)
router.patch('/:id/cancel', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await db.pool.query(
      `SELECT id, invoice_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ error: 'Appointment not found' });
    const now = new Date();
    await db.pool.query(
      `UPDATE ${APPOINTMENTS_TABLE} SET status = $1, updated_at = $2 WHERE id = $3`,
      [STATUS_CANCELED, now, id]
    );
    if (row.invoice_id != null) {
      await db.pool.query(
        `UPDATE ${INVOICES_TABLE} SET payment_status = $1, updated_at = $2 WHERE id = $3`,
        [STATUS_CANCELED, now, row.invoice_id]
      );
    }
    const updated = await db.pool.query(
      `SELECT id, client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, invoice_id, service_type_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    res.json(rowToAppointment(updated.rows[0]));
  } catch (err) {
    console.error('[Appointments] PATCH /:id/cancel error', err);
    return next(err);
  }
});

// DELETE /api/appointments/:id – admin only; hard delete only when status is already canceled
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await db.pool.query(
      `SELECT id, invoice_id, status FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ error: 'Appointment not found' });
    const statusNorm = (row.status || '').toLowerCase();
    if (statusNorm !== (STATUS_CANCELED || '').toLowerCase()) {
      return res.status(400).json({ error: 'Can only delete appointments that are already canceled. Cancel the appointment first.' });
    }
    await db.pool.query(
      `DELETE FROM ${INVOICE_ITEMS_TABLE} WHERE item_type = $1 AND item_id = $2`,
      [INVOICE_ITEM_TYPE_APPOINTMENT, id]
    );
    await db.pool.query(`DELETE FROM ${APPOINTMENTS_TABLE} WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    console.error('[Appointments] DELETE /:id error', err);
    return next(err);
  }
});

module.exports = router;
