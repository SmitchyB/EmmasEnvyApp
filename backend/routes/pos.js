const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { DEFAULT_CURRENCY, POINTS_PER_DOLLAR } = require('../lib/constants');

const APPOINTMENTS_TABLE = 'emmasenvy.appointments';
const STATUS_PAID = 'Paid';
const INVOICES_TABLE = 'emmasenvy.invoices';
const USERS_TABLE = 'emmasenvy.users';
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings';

const router = express.Router();

// POST /api/pos/checkout – complete sale: update or create invoice, set total and payment
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null;
    const totals = body.totals && typeof body.totals === 'object' ? body.totals : {};
    const totalAmount = Number(totals.total);
    const paymentMethod = (body.paymentMethod === 'cash' || body.paymentMethod === 'card') ? body.paymentMethod : 'cash';
    const amountReceived = body.amountReceived != null ? Number(body.amountReceived) : null;
    const changeDue = body.changeDue != null ? Number(body.changeDue) : null;
    const rewardOfferingId = body.reward_offering_id != null ? parseInt(body.reward_offering_id, 10) : null;

    if (Number.isNaN(totalAmount) || totalAmount < 0) {
      return res.status(400).json({ error: 'Invalid totals.total' });
    }

    const now = new Date();

    if (appointmentId != null && !Number.isNaN(appointmentId)) {
      const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';
      if (role !== 'admin' && role !== 'it') {
        return res.status(403).json({ error: 'Staff access required to check out appointments' });
      }
      // Existing appointment: get invoice and update it
      const appResult = await db.db.pool.query(
        `SELECT id, invoice_id, client_name, date FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
        [appointmentId]
      );
      const app = appResult.rows[0];
      if (!app) return res.status(404).json({ error: 'Appointment not found' });

      const invoiceId = app.invoice_id;
      if (invoiceId == null) {
        return res.status(400).json({ error: 'Appointment has no invoice to update' });
      }

      let rewardPointsUsed = null;
      if (rewardOfferingId != null && !Number.isNaN(rewardOfferingId)) {
        const invRow = await db.db.pool.query(`SELECT customer_id FROM ${INVOICES_TABLE} WHERE id = $1`, [invoiceId]);
        const custId = invRow.rows[0]?.customer_id != null ? parseInt(invRow.rows[0].customer_id, 10) : null;
        if (custId != null) {
          const offResult = await db.db.pool.query(
            `SELECT id, point_cost, min_purchase_amount, is_active FROM ${REWARD_OFFERINGS_TABLE} WHERE id = $1`,
            [rewardOfferingId]
          );
          const offering = offResult.rows[0];
          if (offering && offering.is_active) {
            const pointCost = parseInt(offering.point_cost, 10) || 0;
            const userPointsRow = await db.db.pool.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [custId]);
            const userPoints = userPointsRow.rows[0]?.reward_points != null ? parseInt(userPointsRow.rows[0].reward_points, 10) : 0;
            if (userPoints >= pointCost) {
              const subtotalForMin = totals.subtotal != null ? Number(totals.subtotal) : totalAmount;
              const minPurchase = offering.min_purchase_amount != null ? Number(offering.min_purchase_amount) : 0;
              if (subtotalForMin >= minPurchase) {
                rewardPointsUsed = pointCost;
                await db.db.pool.query(
                  `UPDATE ${USERS_TABLE} SET reward_points = GREATEST(0, COALESCE(reward_points, 0) - $1) WHERE id = $2`,
                  [pointCost, custId]
                );
              }
            }
          }
        }
      }
      const updateCols = rewardPointsUsed != null
        ? 'total_amount = $1, payment_method = $2, payment_status = $3, updated_at = $4, amount_received = $5, change_due = $6, reward_offering_id = $7, reward_points_used = $8'
        : 'total_amount = $1, payment_method = $2, payment_status = $3, updated_at = $4, amount_received = $5, change_due = $6';
      const updateVals = rewardPointsUsed != null
        ? [totalAmount, paymentMethod, 'Paid', now, amountReceived ?? totalAmount, changeDue ?? 0, rewardOfferingId, rewardPointsUsed, invoiceId]
        : [totalAmount, paymentMethod, 'Paid', now, amountReceived ?? totalAmount, changeDue ?? 0, invoiceId];
      await db.db.pool.query(
        `UPDATE ${INVOICES_TABLE} SET ${updateCols} WHERE id = ${rewardPointsUsed != null ? '$9' : '$7'}`,
        updateVals
      );

      await db.db.pool.query(
        `UPDATE ${APPOINTMENTS_TABLE} SET status = $1, paid_at = $2 WHERE id = $3`,
        [STATUS_PAID, now, appointmentId]
      );

      const invRow = await db.db.pool.query(`SELECT customer_id FROM ${INVOICES_TABLE} WHERE id = $1`, [invoiceId]);
      const customerId = invRow.rows[0]?.customer_id != null ? parseInt(invRow.rows[0].customer_id, 10) : null;
      if (customerId != null) {
        const pointsAwarded = Math.floor(totalAmount * POINTS_PER_DOLLAR);
        if (pointsAwarded > 0) {
          await db.db.pool.query(
            `UPDATE ${USERS_TABLE} SET reward_points = COALESCE(reward_points, 0) + $1 WHERE id = $2`,
            [pointsAwarded, customerId]
          );
          await db.db.pool.query(
            `UPDATE ${INVOICES_TABLE} SET points_awarded = $1 WHERE id = $2`,
            [pointsAwarded, invoiceId]
          ).catch(() => {});
        }
      }
      return res.json({ success: true, invoiceId });
    }

    return res.status(400).json({ error: 'appointmentId is required (walk-in product sales are no longer supported).' });
  } catch (err) {
    console.error('[POS] POST /checkout error', err);
    return next(err);
  }
});

module.exports = router;
