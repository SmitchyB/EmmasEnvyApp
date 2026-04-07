const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdminOrIT } = require('../middleware/auth');

const router = express.Router();
const TABLE = 'emmasenvy.newsletters';
const PROMO_TABLE = 'emmasenvy.promo_codes';

function rowToNewsletter(row) {
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject,
    content: row.content ?? '',
    promo_code_id: row.promo_code_id != null ? row.promo_code_id : null,
    promo_code: row.promo_code ?? null,
    sent_at: row.sent_at,
    created_by: row.created_by != null ? row.created_by : null,
    created_at: row.created_at,
  };
}

// GET /api/newsletters – list all (admin); optional ?status=draft|sent
router.get('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const status = req.query.status; // 'draft' | 'sent' or omit for all
    let where = '';
    const params = [];
    if (status === 'draft') {
      where = ' WHERE n.sent_at IS NULL';
    } else if (status === 'sent') {
      where = ' WHERE n.sent_at IS NOT NULL';
    }
    const result = await db.pool.query(
      `SELECT n.id, n.subject, n.content, n.promo_code_id, n.sent_at, n.created_by, n.created_at,
              p.code AS promo_code
       FROM ${TABLE} n
       LEFT JOIN ${PROMO_TABLE} p ON p.id = n.promo_code_id
       ${where}
       ORDER BY n.sent_at DESC NULLS LAST, n.created_at DESC, n.id DESC`,
      params
    );
    const newsletters = result.rows.map(rowToNewsletter);
    return res.json({ newsletters });
  } catch (err) {
    return next(err);
  }
});

// GET /api/newsletters/:id – get one (admin)
router.get('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `SELECT n.id, n.subject, n.content, n.promo_code_id, n.sent_at, n.created_by, n.created_at,
              p.code AS promo_code
       FROM ${TABLE} n
       LEFT JOIN ${PROMO_TABLE} p ON p.id = n.promo_code_id
       WHERE n.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found' });
    return res.json({ newsletter: rowToNewsletter(result.rows[0]) });
  } catch (err) {
    return next(err);
  }
});

// POST /api/newsletters – create draft (admin)
router.post('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not found' });
    const { subject, content, promo_code_id } = req.body;
    const subj = (subject && String(subject).trim()) || '';
    if (!subj) return res.status(400).json({ error: 'Subject is required' });
    const body = content != null ? String(content) : '';
    const promoId = promo_code_id == null || promo_code_id === '' ? null : parseInt(promo_code_id, 10);
    if (promo_code_id != null && promo_code_id !== '' && Number.isNaN(promoId)) {
      return res.status(400).json({ error: 'Invalid promo_code_id' });
    }

    const result = await db.pool.query(
      `INSERT INTO ${TABLE} (subject, content, promo_code_id, sent_at, created_by)
       VALUES ($1, $2, $3, NULL, $4)
       RETURNING id, subject, content, promo_code_id, sent_at, created_by, created_at`,
      [subj, body, promoId, userId]
    );
    const row = result.rows[0];
    const promoResult = promoId ? await db.pool.query(`SELECT code FROM ${PROMO_TABLE} WHERE id = $1`, [promoId]) : { rows: [] };
    const out = {
      id: row.id,
      subject: row.subject,
      content: row.content,
      promo_code_id: row.promo_code_id,
      promo_code: promoResult.rows[0]?.code ?? null,
      sent_at: row.sent_at,
      created_by: row.created_by,
      created_at: row.created_at,
    };
    return res.status(201).json({ newsletter: out });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/newsletters/:id – update draft only (admin)
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { subject, content, promo_code_id } = req.body;

    const check = await db.pool.query(`SELECT id, sent_at FROM ${TABLE} WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found' });
    if (check.rows[0].sent_at != null) return res.status(400).json({ error: 'Cannot edit a newsletter that has already been sent' });

    const updates = [];
    const values = [];
    let idx = 1;
    if (subject !== undefined) {
      const subj = String(subject).trim();
      if (!subj) return res.status(400).json({ error: 'Subject cannot be empty' });
      updates.push(`subject = $${idx++}`);
      values.push(subj);
    }
    if (content !== undefined) {
      updates.push(`content = $${idx++}`);
      values.push(String(content));
    }
    if (promo_code_id !== undefined) {
      const promoId = promo_code_id === null || promo_code_id === '' ? null : parseInt(promo_code_id, 10);
      if (promo_code_id !== null && promo_code_id !== '' && Number.isNaN(promoId)) {
        return res.status(400).json({ error: 'Invalid promo_code_id' });
      }
      updates.push(`promo_code_id = $${idx++}`);
      values.push(promoId);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET ${updates.join(', ')}
       WHERE id = $${idx} AND sent_at IS NULL
       RETURNING id, subject, content, promo_code_id, sent_at, created_by, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found or already sent' });
    const row = result.rows[0];
    const promoId = row.promo_code_id;
    const promoResult = promoId ? await db.pool.query(`SELECT code FROM ${PROMO_TABLE} WHERE id = $1`, [promoId]) : { rows: [] };
    const out = {
      id: row.id,
      subject: row.subject,
      content: row.content,
      promo_code_id: row.promo_code_id,
      promo_code: promoResult.rows[0]?.code ?? null,
      sent_at: row.sent_at,
      created_by: row.created_by,
      created_at: row.created_at,
    };
    return res.json({ newsletter: out });
  } catch (err) {
    return next(err);
  }
});

// POST /api/newsletters/:id/send – mark as sent (admin)
router.post('/:id/send', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET sent_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND sent_at IS NULL
       RETURNING id, subject, content, promo_code_id, sent_at, created_by, created_at`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found or already sent' });
    const row = result.rows[0];
    const promoId = row.promo_code_id;
    const promoResult = promoId ? await db.pool.query(`SELECT code FROM ${PROMO_TABLE} WHERE id = $1`, [promoId]) : { rows: [] };
    const out = {
      id: row.id,
      subject: row.subject,
      content: row.content,
      promo_code_id: row.promo_code_id,
      promo_code: promoResult.rows[0]?.code ?? null,
      sent_at: row.sent_at,
      created_by: row.created_by,
      created_at: row.created_at,
    };
    return res.json({ newsletter: out });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/newsletters/:id – drafts only (admin)
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 AND sent_at IS NULL RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found or already sent; cannot delete' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
