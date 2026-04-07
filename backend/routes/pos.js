const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { POINTS_PER_DOLLAR } = require('../lib/constants');
const {
  normalizePromoCode,
  selectPromoByCode,
  selectPromoById,
  getUserUsedPromoCodes,
  promoEligibilityError,
  redeemPromo,
} = require('../lib/promoRedemption');

const APPOINTMENTS_TABLE = 'emmasenvy.appointments';
const STATUS_PAID = 'Paid';
const INVOICES_TABLE = 'emmasenvy.invoices';
const USERS_TABLE = 'emmasenvy.users';
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings';

const router = express.Router();

// POST /api/pos/record-payment – staff: mark appointment paid (invoice totals + payment method)
router.post('/record-payment', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null;
    const totals = body.totals && typeof body.totals === 'object' ? body.totals : {};
    const totalAmount = Number(totals.total);
    const paymentMethod = body.paymentMethod === 'cash' || body.paymentMethod === 'card' ? body.paymentMethod : 'cash';
    const amountReceived = body.amountReceived != null ? Number(body.amountReceived) : null;
    const changeDue = body.changeDue != null ? Number(body.changeDue) : null;
    const rewardOfferingId = body.reward_offering_id != null ? parseInt(body.reward_offering_id, 10) : null;
    const rawPromoCode = body.promoCode != null ? String(body.promoCode).trim() : '';
    const bodyPromoId = body.promo_code_id != null ? parseInt(body.promo_code_id, 10) : null;

    if (Number.isNaN(totalAmount) || totalAmount < 0) {
      return res.status(400).json({ error: 'Invalid totals.total' });
    }

    const now = new Date();

    if (appointmentId != null && !Number.isNaN(appointmentId)) {
      const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';
      if (role !== 'admin' && role !== 'it') {
        return res.status(403).json({ error: 'Staff access required to check out appointments' });
      }

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        const appResult = await client.query(
          `SELECT id, invoice_id, client_name, date, service_type_id FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
          [appointmentId]
        );
        const app = appResult.rows[0];
        if (!app) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Appointment not found' });
        }

        const invoiceId = app.invoice_id;
        if (invoiceId == null) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Appointment has no invoice to update' });
        }

        const invCustRow = await client.query(`SELECT customer_id FROM ${INVOICES_TABLE} WHERE id = $1`, [invoiceId]);
        const customerId =
          invCustRow.rows[0]?.customer_id != null ? parseInt(invCustRow.rows[0].customer_id, 10) : null;

        const subtotal = totals.subtotal != null ? Number(totals.subtotal) : totalAmount;
        const serviceTypeId =
          app.service_type_id != null ? parseInt(app.service_type_id, 10) : null;

        const wantsPromo =
          (rawPromoCode && normalizePromoCode(rawPromoCode)) ||
          (bodyPromoId != null && !Number.isNaN(bodyPromoId));
        if (wantsPromo) {
          if (customerId == null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Promo codes require a customer on the invoice' });
          }
          let promoRow;
          if (rawPromoCode) {
            promoRow = await selectPromoByCode(client, normalizePromoCode(rawPromoCode));
          } else {
            promoRow = await selectPromoById(client, bodyPromoId);
          }
          const usedPromoIds = await getUserUsedPromoCodes(client, customerId);
          const promoErr = promoEligibilityError(promoRow, {
            subtotal,
            serviceTypeId,
            usedPromoIds,
          });
          if (promoErr) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: promoErr });
          }
          try {
            await redeemPromo(client, promoRow.id, customerId);
          } catch (redeemErr) {
            await client.query('ROLLBACK');
            const code = redeemErr.statusCode === 400 ? 400 : 500;
            return res.status(code).json({ error: redeemErr.message || 'Promo redemption failed' });
          }
        }

        let rewardPointsUsed = null;
        if (rewardOfferingId != null && !Number.isNaN(rewardOfferingId)) {
          if (customerId != null) {
            const offResult = await client.query(
              `SELECT id, point_cost, min_purchase_amount, is_active, service_type_id FROM ${REWARD_OFFERINGS_TABLE} WHERE id = $1`,
              [rewardOfferingId]
            );
            const offering = offResult.rows[0];
            if (offering && offering.is_active) {
              const offeringServiceTypeId =
                offering.service_type_id != null ? parseInt(offering.service_type_id, 10) : null;
              if (
                offeringServiceTypeId != null &&
                !Number.isNaN(offeringServiceTypeId) &&
                (serviceTypeId == null || Number.isNaN(serviceTypeId) || serviceTypeId !== offeringServiceTypeId)
              ) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Reward offering does not apply to this service type' });
              }
              const pointCost = parseInt(offering.point_cost, 10) || 0;
              const userPointsRow = await client.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [
                customerId,
              ]);
              const userPoints =
                userPointsRow.rows[0]?.reward_points != null ? parseInt(userPointsRow.rows[0].reward_points, 10) : 0;
              if (userPoints >= pointCost) {
                const subtotalForMin = totals.subtotal != null ? Number(totals.subtotal) : totalAmount;
                const minPurchase = offering.min_purchase_amount != null ? Number(offering.min_purchase_amount) : 0;
                if (subtotalForMin >= minPurchase) {
                  rewardPointsUsed = pointCost;
                  await client.query(
                    `UPDATE ${USERS_TABLE} SET reward_points = GREATEST(0, COALESCE(reward_points, 0) - $1) WHERE id = $2`,
                    [pointCost, customerId]
                  );
                }
              }
            }
          }
        }

        const updateCols =
          rewardPointsUsed != null
            ? 'total_amount = $1, payment_method = $2, payment_status = $3, updated_at = $4, amount_received = $5, change_due = $6, reward_offering_id = $7, reward_points_used = $8'
            : 'total_amount = $1, payment_method = $2, payment_status = $3, updated_at = $4, amount_received = $5, change_due = $6';
        const updateVals =
          rewardPointsUsed != null
            ? [
                totalAmount,
                paymentMethod,
                'Paid',
                now,
                amountReceived ?? totalAmount,
                changeDue ?? 0,
                rewardOfferingId,
                rewardPointsUsed,
                invoiceId,
              ]
            : [totalAmount, paymentMethod, 'Paid', now, amountReceived ?? totalAmount, changeDue ?? 0, invoiceId];
        await client.query(
          `UPDATE ${INVOICES_TABLE} SET ${updateCols} WHERE id = ${rewardPointsUsed != null ? '$9' : '$7'}`,
          updateVals
        );

        await client.query(`UPDATE ${APPOINTMENTS_TABLE} SET status = $1, paid_at = $2 WHERE id = $3`, [
          STATUS_PAID,
          now,
          appointmentId,
        ]);

        if (customerId != null) {
          const pointsAwarded = Math.floor(totalAmount * POINTS_PER_DOLLAR);
          if (pointsAwarded > 0) {
            await client.query(`UPDATE ${USERS_TABLE} SET reward_points = COALESCE(reward_points, 0) + $1 WHERE id = $2`, [
              pointsAwarded,
              customerId,
            ]);
            await client
              .query(`UPDATE ${INVOICES_TABLE} SET points_awarded = $1 WHERE id = $2`, [pointsAwarded, invoiceId])
              .catch(() => {});
          }
        }

        await client.query('COMMIT');
        return res.json({ success: true, invoiceId });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    return res.status(400).json({ error: 'appointmentId is required.' });
  } catch (err) {
    console.error('[POS] POST /record-payment error', err);
    return next(err);
  }
});

module.exports = router;
