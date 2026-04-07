/**
 * Data & privacy: request data export, delete account.
 * POST /api/data-privacy/request-data-export
 * POST /api/data-privacy/delete-account (body: { password })
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const INVOICE_HEADERS_TABLE = 'emmasenvy.invoices';

// POST /api/data-privacy/request-data-export
router.post('/request-data-export', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [userRow, invoicesResult] = await Promise.all([
      db.pool.query(
        `SELECT id, email, phone, first_name, last_name, dob, created_at, updated_at, reward_points
         FROM emmasenvy.users WHERE id = $1`,
        [userId]
      ),
      db.pool.query(
        `SELECT i.invoice_id, i.created_at, i.total_amount, i.currency, i.payment_status
         FROM ${INVOICE_HEADERS_TABLE} i WHERE i.customer_id = $1 ORDER BY i.created_at DESC`,
        [userId]
      ),
    ]);
    const user = userRow.rows[0];
    const invoices = invoicesResult.rows.map((r) => ({
      invoice_id: r.invoice_id,
      created_at: r.created_at,
      total_amount: Number(r.total_amount),
      currency: r.currency,
      payment_status: r.payment_status,
    }));
    const exportData = {
      exported_at: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            email: user.email,
            phone: user.phone,
            first_name: user.first_name,
            last_name: user.last_name,
            dob: user.dob,
            created_at: user.created_at,
            updated_at: user.updated_at,
            reward_points: user.reward_points != null ? parseInt(user.reward_points, 10) : 0,
          }
        : null,
      invoices,
    };
    res.json({
      message: 'Data export ready. You can save the response or we will email you when download is available.',
      export: exportData,
    });
  } catch (err) {
    console.error('[dataPrivacy] POST /request-data-export error', err);
    return next(err);
  }
});

// POST /api/data-privacy/delete-account – body: { password }
router.post('/delete-account', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length === 0) {
      return res.status(400).json({ error: 'Password is required to delete your account.' });
    }
    const row = await db.findUserById(req.user.id);
    if (!row || !row.password) {
      return res.status(400).json({ error: 'Account cannot be deleted this way.' });
    }
    const match = await bcrypt.compare(String(password), row.password);
    if (!match) {
      return res.status(401).json({ error: 'Password is incorrect.' });
    }
    await db.pool.query(
      "UPDATE emmasenvy.users SET status = 'deleted', updated_at = $1 WHERE id = $2",
      [new Date(), req.user.id]
    );
    res.json({ message: 'Account has been deleted. You have been signed out.' });
  } catch (err) {
    console.error('[dataPrivacy] POST /delete-account error', err);
    return next(err);
  }
});

module.exports = router;
