/**
 * POS checkout: complete cash (or card) sale and update invoice.
 * POST /api/pos/checkout – auth required.
 * Body: { appointmentId?, productLines, totals: { total, ... }, paymentMethod, amountReceived?, changeDue? }
 * For cash: amountReceived and changeDue are saved to the invoice when provided.
 * Updates existing invoice when appointmentId present; otherwise creates walk-in invoice.
 */

const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { DEFAULT_CURRENCY, POINTS_PER_DOLLAR } = require('../lib/constants');

const APPOINTMENTS_TABLE = 'emmasenvy.appointments';
const INVOICES_TABLE = 'emmasenvy.invoices';
const INVOICE_ITEMS_TABLE = 'emmasenvy.invoice_items';
const USERS_TABLE = 'emmasenvy.users';
const INVOICE_ITEM_TYPE_APPOINTMENT = process.env.INVOICE_ITEM_TYPE_APPOINTMENT || 'Appointment';
const INVOICE_ITEM_TYPE_PRODUCT = process.env.INVOICE_ITEM_TYPE_PRODUCT || 'Product';
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings';

function generateWalkInInvoiceId(dateStr) {
  const datePart = (dateStr || '').replace(/-/g, '').slice(0, 8) || '00000000';
  return `WK${datePart}`;
}

const router = express.Router();

// POST /api/pos/checkout – complete sale: update or create invoice, set total and payment
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null;
    const productLines = Array.isArray(body.productLines) ? body.productLines : [];
    const totals = body.totals && typeof body.totals === 'object' ? body.totals : {};
    const totalAmount = Number(totals.total);
    const paymentMethod = (body.paymentMethod === 'cash' || body.paymentMethod === 'card') ? body.paymentMethod : 'cash';
    const createdBy = req.user?.id ?? null;
    const amountReceived = body.amountReceived != null ? Number(body.amountReceived) : null;
    const changeDue = body.changeDue != null ? Number(body.changeDue) : null;
    const walkInCustomerId = body.customerId != null && body.customerId !== '' ? parseInt(body.customerId, 10) : null;
    const rewardOfferingId = body.reward_offering_id != null ? parseInt(body.reward_offering_id, 10) : null;

    if (Number.isNaN(totalAmount) || totalAmount < 0) {
      return res.status(400).json({ error: 'Invalid totals.total' });
    }

    const now = new Date();

    if (appointmentId != null && !Number.isNaN(appointmentId)) {
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

      // Add invoice_items for each product line
      for (const line of productLines) {
        const productId = parseInt(line.productId, 10);
        const quantity = Math.max(1, parseInt(line.quantity, 10) || 1);
        const price = Number(line.price);
        const title = (line.title && String(line.title).trim()) || 'Product';
        if (Number.isNaN(productId) || productId <= 0) continue;
        await db.db.pool.query(
          `INSERT INTO ${INVOICE_ITEMS_TABLE} (invoice_id, item_id, item_type, title, price, quantity, image, assigned_employee, selected_variant)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7)`,
          [invoiceId, productId, INVOICE_ITEM_TYPE_PRODUCT, title, price, quantity, line.variantId != null ? String(line.variantId) : null]
        );
      }

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

    // Walk-in: no appointment – create new invoice with product lines only
    if (productLines.length === 0) {
      return res.status(400).json({ error: 'No appointment or product lines' });
    }

    const today = now.toISOString().slice(0, 10);
    const prefix = generateWalkInInvoiceId(today);
    const countResult = await db.db.pool.query(
      `SELECT COUNT(*) AS c FROM ${INVOICES_TABLE} WHERE invoice_id LIKE $1`,
      [prefix + '%']
    );
    const n = (parseInt(countResult.rows[0].c, 10) || 0) + 1;
    const humanInvoiceId = `${prefix}-${n}`;

    let walkInName = 'Walk-in';
    let walkInEmail = '';
    let walkInPhone = '';
    if (walkInCustomerId != null && !Number.isNaN(walkInCustomerId)) {
      const userRow = await db.db.pool.query(
        `SELECT first_name, last_name, email, phone FROM ${USERS_TABLE} WHERE id = $1`,
        [walkInCustomerId]
      );
      if (userRow.rows[0]) {
        const u = userRow.rows[0];
        walkInName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Walk-in';
        walkInEmail = u.email || '';
        walkInPhone = u.phone || '';
      }
    }
    const insertCustomerId = walkInCustomerId != null && !Number.isNaN(walkInCustomerId) ? walkInCustomerId : null;

    let walkInRewardOfferingId = null;
    let walkInRewardPointsUsed = null;
    if (insertCustomerId != null && rewardOfferingId != null && !Number.isNaN(rewardOfferingId)) {
      const offResult = await db.db.pool.query(
        `SELECT id, point_cost, min_purchase_amount, is_active FROM ${REWARD_OFFERINGS_TABLE} WHERE id = $1`,
        [rewardOfferingId]
      );
      const offering = offResult.rows[0];
      if (offering && offering.is_active) {
        const pointCost = parseInt(offering.point_cost, 10) || 0;
        const userPointsRow = await db.db.pool.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [insertCustomerId]);
        const userPoints = userPointsRow.rows[0]?.reward_points != null ? parseInt(userPointsRow.rows[0].reward_points, 10) : 0;
        const subtotalForMin = totals.subtotal != null ? Number(totals.subtotal) : totalAmount;
        const minPurchase = offering.min_purchase_amount != null ? Number(offering.min_purchase_amount) : 0;
        if (userPoints >= pointCost && subtotalForMin >= minPurchase) {
          walkInRewardOfferingId = rewardOfferingId;
          walkInRewardPointsUsed = pointCost;
          await db.db.pool.query(
            `UPDATE ${USERS_TABLE} SET reward_points = GREATEST(0, COALESCE(reward_points, 0) - $1) WHERE id = $2`,
            [pointCost, insertCustomerId]
          );
        }
      }
    }

    const invResult = await db.db.pool.query(
      `INSERT INTO ${INVOICES_TABLE} (
          invoice_id, customer_id, name, email, phone, created_by, total_amount, currency, payment_status, payment_method, status, created_at, updated_at, amount_received, change_due, reward_offering_id, reward_points_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $11, $12, $13, $14, $15)
        RETURNING id`,
      [humanInvoiceId, insertCustomerId, walkInName, walkInEmail, walkInPhone, createdBy, totalAmount, DEFAULT_CURRENCY, 'Paid', paymentMethod, now, amountReceived ?? totalAmount, changeDue ?? 0, walkInRewardOfferingId, walkInRewardPointsUsed]
    );
    const newInvoiceId = invResult.rows[0].id;

    for (const line of productLines) {
      const productId = parseInt(line.productId, 10);
      const quantity = Math.max(1, parseInt(line.quantity, 10) || 1);
      const price = Number(line.price);
      const title = (line.title && String(line.title).trim()) || 'Product';
      if (Number.isNaN(productId) || productId <= 0) continue;
      await db.db.pool.query(
        `INSERT INTO ${INVOICE_ITEMS_TABLE} (invoice_id, item_id, item_type, title, price, quantity, image, assigned_employee, selected_variant)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7)`,
        [newInvoiceId, productId, INVOICE_ITEM_TYPE_PRODUCT, title, price, quantity, line.variantId != null ? String(line.variantId) : null]
      );
    }

    if (insertCustomerId != null) {
      const pointsAwarded = Math.floor(totalAmount * POINTS_PER_DOLLAR);
      if (pointsAwarded > 0) {
        await db.db.pool.query(
          `UPDATE ${USERS_TABLE} SET reward_points = COALESCE(reward_points, 0) + $1 WHERE id = $2`,
          [pointsAwarded, insertCustomerId]
        );
        await db.db.pool.query(
          `UPDATE ${INVOICES_TABLE} SET points_awarded = $1 WHERE id = $2`,
          [pointsAwarded, newInvoiceId]
        ).catch(() => {});
      }
    }
    return res.json({ success: true, invoiceId: newInvoiceId });
  } catch (err) {
    console.error('[POS] POST /checkout error', err);
    return next(err);
  }
});

module.exports = router;
