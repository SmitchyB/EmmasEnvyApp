//This file is used to handle the POS checkout process for the backend

const express = require('express'); //express is a web framework for node.js
const db = require('../lib/db'); //db is the database connection
const { requireAuth } = require('../middleware/auth'); //requireAuth is the middleware function to check if the user is authenticated
const { POINTS_PER_DOLLAR } = require('../lib/constants'); //POINTS_PER_DOLLAR is the number of points per dollar
const {
  normalizePromoCode, //normalizePromoCode is the function to normalize the promo code
  selectPromoByCode, //selectPromoByCode is the function to select the promo code by code
  selectPromoById, //selectPromoById is the function to select the promo code by id 
  getUserUsedPromoCodes, //getUserUsedPromoCodes is the function to get the used promo codes by user id
  promoEligibilityError, //promoEligibilityError is the function to check if the promo code is eligible
  redeemPromo, //redeemPromo is the function to redeem the promo code
} = require('../lib/promoRedemption'); 
const {
  computeCheckoutBreakdown, //computeCheckoutBreakdown is the function to compute the checkout breakdown
  buildIdempotencyKey, //buildIdempotencyKey is the function to build the idempotency key
  roundMoney, //roundMoney is the function to round the money
} = require('../lib/posCheckout');
const { getPayment, verifyPaymentTotal, createApiCardPayment } = require('../lib/squareService'); //getPayment is the function to get the payment from the square service
const APPOINTMENTS_TABLE = 'emmasenvy.appointments'; //APPOINTMENTS_TABLE is the table name for the appointments
const STATUS_PAID = 'Paid'; //STATUS_PAID is the status for the paid appointments
const STATUS_COMPLETE = 'Complete'; //STATUS_COMPLETE is the status for the complete appointments
const INVOICES_TABLE = 'emmasenvy.invoices'; //INVOICES_TABLE is the table name for the invoices
const USERS_TABLE = 'emmasenvy.users'; //USERS_TABLE is the table name for the users
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings'; //REWARD_OFFERINGS_TABLE is the table name for the reward offerings
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type'; //SERVICE_TYPE_TABLE is the table name for the service types

const router = express.Router(); //router is the router for the pos routes

//Function to check if the user can checkout
function canPosCheckout(role) {
  const r = role ? String(role).toLowerCase() : '';
  return r === 'admin' || r === 'it';
}

//Function to finalize the pos card payment
async function finalizePosCardPayment(res, client, o) {
  const { appointmentId, body, payment, breakdown, ctx, disc, idempotencyKey, squarePaymentId, tip } = o; //o is the object containing the appointment id, body, payment, breakdown, ctx, disc, idempotency key, square payment id, and tip
  const { ok, actualTotal } = verifyPaymentTotal(payment, breakdown.grand_total); //verifyPaymentTotal is the function to verify the payment total
  //If the payment total does not match the expected total, return an error
  if (!ok) {
    await client.query('ROLLBACK'); //ROLLBACK is the function to rollback the transaction
    //Return an error response
    return res.status(400).json({
      error: `Square payment total ($${actualTotal.toFixed(2)}) does not match expected $${breakdown.grand_total.toFixed(2)}`,
    });
  }
  //Get the reward offering id from the body
  const rewardOid =
    body.reward_offering_id != null && !Number.isNaN(parseInt(body.reward_offering_id, 10))
      ? parseInt(body.reward_offering_id, 10)
      : null;
  const rawPromoCode = body.promoCode != null ? String(body.promoCode).trim() : ''; //rawPromoCode is the raw promo code from the body
  const bodyPromoId = body.promo_code_id != null ? parseInt(body.promo_code_id, 10) : null; //bodyPromoId is the promo id from the body
  //This checks if the user wants to use a promo code
  const wantsPromo =
    (rawPromoCode && normalizePromoCode(rawPromoCode)) || (bodyPromoId != null && !Number.isNaN(bodyPromoId));
    //If the user wants to use a promo code and the customer id is not null, then redeem the promo code
    if (wantsPromo && ctx.customerId != null) {
      let promoRow; //promoRow is the promo row from the database
      //If the user wants to use a promo code by code, then select the promo code by code
      if (rawPromoCode) {
        promoRow = await selectPromoByCode(client, normalizePromoCode(rawPromoCode)); //selectPromoByCode is the function to select the promo code by code
      } 
      //Else if the user wants to use a promo code by id, then select the promo code by id
      else {
        promoRow = await selectPromoById(client, bodyPromoId); //selectPromoById is the function to select the promo code by id
      }
      //Try to redeem the promo code
      try {
        await redeemPromo(client, promoRow.id, ctx.customerId); // This function will increment the usage count and record the customer used the promo code
      } catch (redeemErr) {
        await client.query('ROLLBACK'); //ROLLBACK is the function to rollback the transaction
        const code = redeemErr.statusCode === 400 ? 400 : 500; //code is the status code for the error
        return res.status(code).json({ error: redeemErr.message || 'Promo redemption failed' }); //Return an error response
      }
    }

  let rewardPointsUsed = null; //let the reward points used be null
  //If the reward offering id is not null and the customer id is not null and the reward row is not null, then deduct the reward points from the customer
  if (rewardOid != null && ctx.customerId != null && disc.rewardRow) {
    const pointCost = parseInt(disc.rewardRow.point_cost, 10) || 0; //pointCost is the point cost of the reward offering
    rewardPointsUsed = pointCost; //rewardPointsUsed is the reward points used
    //await for the query to deduct the reward points from the customer
    await client.query(
      `UPDATE ${USERS_TABLE} SET reward_points = GREATEST(0, COALESCE(reward_points, 0) - $1) WHERE id = $2`,
      [pointCost, ctx.customerId]
    );
  }

  const now = new Date(); //set the current date and time
  const totalAmount = breakdown.grand_total; //set the total amount to the grand total
  const amountReceived = totalAmount; //set the amount received to the total amount
  const changeDue = 0; //set the change due to 0
  //create a snapshot object containing the breakdown, square payment id, and payment method
  const snapshotObj = {
    breakdown, //set the breakdown to the breakdown
    square_payment_id: squarePaymentId, //set the square payment id to the square payment id
    payment_method: 'card', //set the payment method to card
  };
  //await for the query to update the invoice
  await client.query(
    `UPDATE ${INVOICES_TABLE}
     SET total_amount = $1,
         payment_method = $2,
         payment_status = $3,
         updated_at = $4,
         amount_received = $5,
         change_due = $6,
         reward_offering_id = $7,
         reward_points_used = $8,
         tip_amount = $9,
         square_payment_id = $10,
         checkout_idempotency_key = $11,
         checkout_snapshot = $12::jsonb
     WHERE id = $13`,
    [
      totalAmount,
      'card',
      'Paid',
      now,
      amountReceived,
      changeDue,
      rewardOid,
      rewardPointsUsed,
      roundMoney(tip),
      squarePaymentId,
      idempotencyKey,
      snapshotObj,
      ctx.invoiceId,
    ]
  );
  //await for the query to update the appointment status to paid
  await client.query(`UPDATE ${APPOINTMENTS_TABLE} SET status = $1, paid_at = $2 WHERE id = $3`, [
    STATUS_PAID,
    now,
    appointmentId,
  ]);

  let pointsAwarded = 0; //set the points awarded to 0
  //If the customer id is not null, then award the points to the customer
  if (ctx.customerId != null) {
    pointsAwarded = Math.floor(totalAmount * POINTS_PER_DOLLAR); //set the points awarded to the total amount multiplied by the points per dollar
    //If the points awarded is greater than 0, then award the points to the customer
    if (pointsAwarded > 0) {
      //await for the query to update the user's reward points
      await client.query(`UPDATE ${USERS_TABLE} SET reward_points = COALESCE(reward_points, 0) + $1 WHERE id = $2`, [
        pointsAwarded,
        ctx.customerId,
      ]);
      await client
        .query(`UPDATE ${INVOICES_TABLE} SET points_awarded = $1 WHERE id = $2`, [pointsAwarded, ctx.invoiceId])
        .catch(() => {});
    }
  }

  let customerRewardPointsAfter = null; //set the customer reward points after to null
  //If the customer id is not null, then get the customer's reward points after
  if (ctx.customerId != null) {
    const prAfter = await client.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [ctx.customerId]);
    //set the customer reward points after to the customer's reward points
    customerRewardPointsAfter =
      prAfter.rows[0]?.reward_points != null ? parseInt(prAfter.rows[0].reward_points, 10) : 0;
  }

  await client.query('COMMIT'); //COMMIT is the function to commit the transaction
  //Return a success response
  return res.json({
    success: true,
    invoiceId: ctx.invoiceId,
    square_payment_id: squarePaymentId,
    points_awarded: pointsAwarded,
    customer_reward_points: customerRewardPointsAfter,
    payment_method: 'card',
    grand_total: totalAmount,
    amount_received: totalAmount,
    change_due: 0,
  });
}

//Function to parse the invoice foreign key integer
function parseInvoiceFkInt(val) {
  if (val == null || val === '') return null; //If the value is null or empty, return null
  const n = typeof val === 'number' ? val : parseInt(String(val), 10); //parse the value to an integer
  if (!Number.isInteger(n) || n < 1) return null; //If the value is not an integer or is less than 1, return null
  return n; //return the integer
}

//Function to load the appointment, invoice customer, and service price
async function loadPosAppointmentContext(client, appointmentId) {
  //await for the query to select the appointment, invoice customer, and service price
  const appResult = await client.query(
    `SELECT a.id, a.invoice_id, a.service_type_id, a.status,
            COALESCE(st.price, 0)::float AS service_price
     FROM ${APPOINTMENTS_TABLE} a
     LEFT JOIN ${SERVICE_TYPE_TABLE} st ON st.id = a.service_type_id
     WHERE a.id = $1`,
    [appointmentId]
  );
  const app = appResult.rows[0]; //set the appointment to the appointment row
  if (!app) return { error: 'Appointment not found', status: 404 }; //If the appointment is not found, return an error
  //If the appointment status is not complete, return an error
  if (String(app.status) !== STATUS_COMPLETE) {
    return { error: 'Appointment must be Complete before checkout', status: 400 }; //Set the error to 'Appointment must be Complete before checkout' and the status to 400
  }
  const invoiceId = app.invoice_id; //set the invoice id to the invoice id
  //If the invoice id is null, return an error
  if (invoiceId == null) {
    return { error: 'Appointment has no invoice', status: 400 }; //Set the error to 'Appointment has no invoice' and the status to 400
  }
  //await for the query to select the invoice
  const invRow = await client.query(
    `SELECT id, customer_id, payment_status FROM ${INVOICES_TABLE} WHERE id = $1`,
    [invoiceId]
  );
  const inv = invRow.rows[0]; //set the invoice to the invoice row
  if (!inv) return { error: 'Invoice not found', status: 400 }; //If the invoice is not found, return an error
  //If the invoice payment status is paid, return an error
  if (String(inv.payment_status) === 'Paid') {
    return { error: 'Invoice is already paid', status: 400 }; //Set the error to 'Invoice is already paid' and the status to 400
  }
  const customerId = parseInvoiceFkInt(inv.customer_id); //set the customer id to the customer id
  const serviceTypeId = parseInvoiceFkInt(app.service_type_id); //set the service type id to the service type id
  const serviceSubtotal = roundMoney(Number(app.service_price) || 0); //set the service subtotal to the service price rounded to 2 decimal places

  //Return the appointment, invoice id, customer id, service type id, and service subtotal
  return {
    app,
    invoiceId,
    customerId,
    serviceTypeId,
    serviceSubtotal,
  };
}

//Function to resolve the promo and reward rows and run eligibility
async function resolveCheckoutDiscounts(client, ctx, body) {
  const rawPromoCode = body.promoCode != null ? String(body.promoCode).trim() : '';//Set the raw promo code to the promo code from the body
  const bodyPromoId = body.promo_code_id != null ? parseInt(body.promo_code_id, 10) : null; //Set the body promo id to the promo id from the body
  const rewardOfferingId = body.reward_offering_id != null ? parseInt(body.reward_offering_id, 10) : null; //Set the reward offering id to the reward offering id from the body
  const { customerId, serviceTypeId, serviceSubtotal } = ctx; //Set the customer id, service type id, and service subtotal to the customer id, service type id, and service subtotal from the context

  let promoRow = null; //Set the promo row to null
  //This checks if the user wants to use a promo code
  const wantsPromo =
    (rawPromoCode && normalizePromoCode(rawPromoCode)) || (bodyPromoId != null && !Number.isNaN(bodyPromoId)); //This checks if the user wants to use a promo code by code or by id
  //If the user wants to use a promo code, then check if the customer id is not null
  if (wantsPromo) {
    //If the customer id is null, return an error
    if (customerId == null) {
      return { error: 'Promo codes require a customer on the invoice', status: 400 }; //Set the error to 'Promo codes require a customer on the invoice' and the status to 400
    }
    //If the user wants to use a promo code by code, then select the promo code by code
    if (rawPromoCode) {
      promoRow = await selectPromoByCode(client, normalizePromoCode(rawPromoCode)); //await for the query to select the promo code by code
    } 
    //Else if the user wants to use a promo code by id, then select the promo code by id
    else {
      promoRow = await selectPromoById(client, bodyPromoId); //await for the query to select the promo code by id
    }
    const usedPromoIds = await getUserUsedPromoCodes(client, customerId); //await for the query to get the used promo codes by customer id
    //Check if the promo code is eligible
    const promoErr = promoEligibilityError(promoRow, {
      subtotal: serviceSubtotal, //Set the subtotal to the service subtotal
      serviceTypeId, //Set the service type id to the service type id
      usedPromoIds, //Set the used promo ids to the used promo ids
    });
    //If the promo code is not eligible, return an error
    if (promoErr) {
      return { error: promoErr, status: 400 }; //Set the error to the promo error and the status to 400
    }
  }

  let rewardRow = null; //Set the reward row to null
  //If the reward offering id is not null and the reward offering id is not a number, then check if the customer id is not null
  if (rewardOfferingId != null && !Number.isNaN(rewardOfferingId)) {
    //If the customer id is null, return an error
    if (customerId == null) {
      return { error: 'Reward redemptions require a customer on the invoice', status: 400 }; //Set the error to 'Reward redemptions require a customer on the invoice' and the status to 400
    }
    //await for the query to select the reward offering
    const offResult = await client.query(
      `SELECT id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id
       FROM ${REWARD_OFFERINGS_TABLE} WHERE id = $1`,
      [rewardOfferingId]
    );
    rewardRow = offResult.rows[0]; //set the reward row to the reward offering row
    //If the reward row is not found or the reward row is not active, return an error
    if (!rewardRow || !rewardRow.is_active) {
      return { error: 'Invalid or inactive reward offering', status: 400 }; //Set the error to 'Invalid or inactive reward offering' and the status to 400
    }
    //Get the offering service type id
    const offeringServiceTypeId =
      rewardRow.service_type_id != null ? parseInt(rewardRow.service_type_id, 10) : null;
    //If the offering service type id is not null and the offering service type id is not a number and the service type id is not null and the service type id is not a number and the offering service type id is not the same as the service type id, then return an error
    if (
      offeringServiceTypeId != null &&
      !Number.isNaN(offeringServiceTypeId) &&
      (serviceTypeId == null || Number.isNaN(serviceTypeId) || serviceTypeId !== offeringServiceTypeId)
    ) {
      return { error: 'Reward offering does not apply to this service type', status: 400 }; //Return an error response
    }
    const pointCost = parseInt(rewardRow.point_cost, 10) || 0; //set the point cost to the point cost of the reward offering
    const userPointsRow = await client.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [customerId]); //await for the query to get the user's reward points
    //set the user points to the user's reward points
    const userPoints =
      userPointsRow.rows[0]?.reward_points != null ? parseInt(userPointsRow.rows[0].reward_points, 10) : 0;
    //If the user points is less than the point cost, then return an error
    if (userPoints < pointCost) {
      return { error: 'Not enough reward points for this offering', status: 400 }; //Return an error response
    }
    const minPurchase = rewardRow.min_purchase_amount != null ? Number(rewardRow.min_purchase_amount) : 0; //set the minimum purchase to the minimum purchase amount of the reward offering
    //If the service subtotal is less than the minimum purchase, then return an error
    if (serviceSubtotal < minPurchase) {
      return { error: `Minimum purchase of $${minPurchase.toFixed(2)} required for this reward`, status: 400 }; //Return an error response
    }
  }

  return { promoRow, rewardRow };
}

//Post API route to preview the checkout
router.post('/preview', requireAuth, async (req, res, next) => {
  //Try to preview the checkout
  try {
    const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : ''; //set the role to the role from the request
    //If the role is not an admin or IT, then return an error
    if (!canPosCheckout(role)) {
      return res.status(403).json({ error: 'Admin or IT access required for POS preview' }); //Return an error response
    }
    const body = req.body || {}; //set the body to the body from the request
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null; //set the appointment id to the appointment id from the body
    //If the appointment id is null or not a number, then return an error
    if (appointmentId == null || Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'appointmentId is required' }); //Return an error response
    }
    const tip = body.tip != null ? Number(body.tip) : 0; //set the tip to the tip from the body
    //If the tip is not a number or is less than 0, then return an error
    if (Number.isNaN(tip) || tip < 0) {
      return res.status(400).json({ error: 'tip must be a non-negative number' }); //Return an error response
    }

    const client = await db.pool.connect(); //connect to the database
    //Try to load the appointment context
    try {
      const ctx = await loadPosAppointmentContext(client, appointmentId); //await for the query to load the appointment context
      //If the context has an error, then return an error
      if (ctx.error) {
        return res.status(ctx.status).json({ error: ctx.error }); //Return an error response
      }

      const disc = await resolveCheckoutDiscounts(client, ctx, body); //await for the query to resolve the checkout discounts
      //If the discounts have an error, then return an error
      if (disc.error) {
        return res.status(disc.status).json({ error: disc.error }); //Return an error response
      }

      //Compute the checkout breakdown
      const breakdown = computeCheckoutBreakdown({
        serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
        promoRow: disc.promoRow, //Set the promo row to the promo row
        rewardRow: disc.rewardRow, //Set the reward row to the reward row
        tip, //Set the tip to the tip
      });
      //Set the promo key to the promo code from the body
      const promoKey = body.promoCode
        ? normalizePromoCode(String(body.promoCode))
        : body.promo_code_id != null
          ? `id:${body.promo_code_id}`
          : '';
      //Set the reward id to the reward offering id from the body
      const rewardIdNorm =
        body.reward_offering_id != null && !Number.isNaN(parseInt(body.reward_offering_id, 10))
          ? parseInt(body.reward_offering_id, 10)
          : null;
      //Build the idempotency key
      const idempotencyKey = buildIdempotencyKey({
        appointmentId, //Set the appointment id to the appointment id
        serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
        promo: promoKey, //Set the promo key to the promo key
        reward_offering_id: rewardIdNorm, //Set the reward id to the reward id
        tip: roundMoney(tip), //Set the tip to the tip
      });
      let customerPoints = null; //Set the customer points to null
      //If the customer id is not null, then get the customer's reward points
      if (ctx.customerId != null) {
        const pr = await client.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [ctx.customerId]); //await for the query to get the customer's reward points
        customerPoints = pr.rows[0]?.reward_points != null ? parseInt(pr.rows[0].reward_points, 10) : 0; //set the customer points to the customer's reward points
      }

      return res.json({
        appointment_id: appointmentId,
        invoice_id: ctx.invoiceId,
        customer_id: ctx.customerId,
        ...breakdown,
        idempotency_key: idempotencyKey,
        customer_reward_points: customerPoints,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POS] POST /preview error', err); //Log the error
    return next(err);
  }
});

//Post API route to complete the card payment
router.post('/complete-card', requireAuth, async (req, res, next) => {
  //Try to complete the card payment
  try {
    const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : ''; //set the role to the role from the request
    //If the role is not an admin or IT, then return an error
    if (!canPosCheckout(role)) {
      return res.status(403).json({ error: 'Admin or IT access required' }); //Return an error response
    }
    const body = req.body || {}; //set the body to the body from the request
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null; //set the appointment id to the appointment id from the body  
    const squarePaymentId = body.squarePaymentId != null ? String(body.squarePaymentId).trim() : ''; //set the square payment id to the square payment id from the body
    const idempotencyKey = body.checkout_idempotency_key != null ? String(body.checkout_idempotency_key).trim() : ''; //set the idempotency key to the idempotency key from the body
    const tip = body.tip != null ? Number(body.tip) : 0; //set the tip to the tip from the body
    //If the appointment id is null or not a number or the square payment id is null, then return an error
    if (!appointmentId || Number.isNaN(appointmentId) || !squarePaymentId) {
      return res.status(400).json({ error: 'appointmentId and squarePaymentId are required' }); //Return an error response
    }
    //If the idempotency key is null, then return an error
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'checkout_idempotency_key is required' }); //Return an error response
    }
    //If the tip is not a number or is less than 0, then return an error
    if (Number.isNaN(tip) || tip < 0) {
      return res.status(400).json({ error: 'tip must be a non-negative number' }); //Return an error response
    }

    let payment; //set the payment to null
    //Try to get the payment
    try {
      payment = await getPayment(squarePaymentId); //await for the query to get the payment
    } catch (e) {
      console.error('[POS] complete-card getPayment', e); //Log the error
      return res.status(400).json({ error: e.body?.errors?.[0]?.detail || e.message || 'Could not load Square payment' });
    }

    const client = await db.pool.connect(); //connect to the database
    //Try to complete the card payment
    try {
      await client.query('BEGIN'); //BEGIN is the function to begin the transaction

      const ctx = await loadPosAppointmentContext(client, appointmentId); //await for the query to load the appointment context
      //If the context has an error, then return an error
      if (ctx.error) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        return res.status(ctx.status).json({ error: ctx.error }); //Return an error response
      }

      const disc = await resolveCheckoutDiscounts(client, ctx, body); //await for the query to resolve the checkout discounts
      //If the discounts have an error, then return an error
      if (disc.error) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        return res.status(disc.status).json({ error: disc.error }); //Return an error response
      }

      //Compute the checkout breakdown
      const breakdown = computeCheckoutBreakdown({
        serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
        promoRow: disc.promoRow, //Set the promo row to the promo row
        rewardRow: disc.rewardRow, //Set the reward row to the reward row
        tip, //Set the tip to the tip
      });
      //Set the promo key to the promo code from the body
      const promoKey = body.promoCode
        ? normalizePromoCode(String(body.promoCode))
        : body.promo_code_id != null
          ? `id:${body.promo_code_id}`
          : '';
      //Set the reward id to the reward offering id from the body
      const rewardIdForKey =
        body.reward_offering_id != null && !Number.isNaN(parseInt(body.reward_offering_id, 10))
          ? parseInt(body.reward_offering_id, 10)
          : null;
      //Build the idempotency key
      const expectedKey = buildIdempotencyKey({
        appointmentId,
        serviceSubtotal: ctx.serviceSubtotal,
        promo: promoKey,
        reward_offering_id: rewardIdForKey,
        tip: roundMoney(tip),
      });
      //If the expected key does not match the idempotency key, then return an error
      if (expectedKey !== idempotencyKey) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        return res.status(400).json({ error: 'Checkout does not match current totals; refresh preview and try again' });
      }

      //Finalize the card payment
      return finalizePosCardPayment(res, client, {
        appointmentId, //Set the appointment id to the appointment id
        body, //Set the body to the body
        payment, //Set the payment to the payment
        breakdown, //Set the breakdown to the breakdown
        ctx, //Set the context to the context
        disc, //Set the discounts to the discounts
        idempotencyKey, //Set the idempotency key to the idempotency key
        squarePaymentId, //Set the square payment id to the square payment id
        tip, //Set the tip to the tip
      });
    } catch (err) {
      await client.query('ROLLBACK'); //Await for the query to rollback the transaction
      throw err;
    } finally {
      client.release(); //Release the client
    }
  } catch (err) {
    console.error('[POS] POST /complete-card error', err); //Log the error
    return next(err);
  }
});

//Post API route to charge the card via the Payments API
router.post('/charge-card-api', requireAuth, async (req, res, next) => {
  //Try to charge the card via the Payments API
  try {
    const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : ''; //set the role to the role from the request
    //If the role is not an admin or IT, then return an error
    if (!canPosCheckout(role)) {
      return res.status(403).json({ error: 'Admin or IT access required' }); //Return an error response
    }
    const isProd = process.env.SQUARE_ENVIRONMENT === 'production'; //set the is prod to the square environment is production
    //If the is prod is true and the pos allow server card charge is not true, then return an error
    if (isProd && process.env.POS_ALLOW_SERVER_CARD_CHARGE !== 'true') {
      //Return an error response
      return res.status(403).json({
        error:
          'Server-side Payments API charge is disabled in production. Set POS_ALLOW_SERVER_CARD_CHARGE=true to enable, or use POST /api/pos/complete-card with a payment id from a client.',
      });
    }

    const body = req.body || {}; //set the body to the body from the request
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null; //set the appointment id to the appointment id from the body
    const idempotencyKey = body.checkout_idempotency_key != null ? String(body.checkout_idempotency_key).trim() : ''; //set the idempotency key to the idempotency key from the body
    const tip = body.tip != null ? Number(body.tip) : 0; //set the tip to the tip from the body

    //If the appointment id is null or not a number, then return an error
    if (!appointmentId || Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'appointmentId is required' }); //Return an error response
    }
    //If the idempotency key is null, then return an error
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'checkout_idempotency_key is required' }); //Return an error response
    }
    //If the tip is not a number or is less than 0, then return an error
    if (Number.isNaN(tip) || tip < 0) {
      return res.status(400).json({ error: 'tip must be a non-negative number' }); //Return an error response
    }

    const client = await db.pool.connect(); //connect to the database
    //Try to charge the card via the Payments API
    try {
      await client.query('BEGIN'); //BEGIN is the function to begin the transaction

      const ctx = await loadPosAppointmentContext(client, appointmentId); //await for the query to load the appointment context
      //If the context has an error, then return an error
      if (ctx.error) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        return res.status(ctx.status).json({ error: ctx.error }); //Return an error response
      }

      const disc = await resolveCheckoutDiscounts(client, ctx, body); //await for the query to resolve the checkout discounts
      //If the discounts have an error, then return an error
      if (disc.error) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        return res.status(disc.status).json({ error: disc.error }); //Return an error response
      }

      //Compute the checkout breakdown
      const breakdown = computeCheckoutBreakdown({
        serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
        promoRow: disc.promoRow, //Set the promo row to the promo row
        rewardRow: disc.rewardRow, //Set the reward row to the reward row
        tip, //Set the tip to the tip
      });
      //Set the promo key to the promo code from the body
      const promoKey = body.promoCode
        ? normalizePromoCode(String(body.promoCode))
        : body.promo_code_id != null
          ? `id:${body.promo_code_id}`
          : '';
      //Set the reward id to the reward offering id from the body
      const rewardIdForKey =
        body.reward_offering_id != null && !Number.isNaN(parseInt(body.reward_offering_id, 10))
          ? parseInt(body.reward_offering_id, 10)
          : null;
      //Build the idempotency key
      const expectedKey = buildIdempotencyKey({
        appointmentId, //Set the appointment id to the appointment id
        serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
        promo: promoKey, //Set the promo key to the promo key
        reward_offering_id: rewardIdForKey, //Set the reward id to the reward id
        tip: roundMoney(tip), //Set the tip to the tip
      });
      //If the expected key does not match the idempotency key, then return an error
      if (expectedKey !== idempotencyKey) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        return res.status(400).json({ error: 'Checkout does not match current totals; refresh preview and try again' });
      }

      //Set the square card nonce to the square card nonce from the body
      const squareCardNonce =
        body.square_card_nonce != null && String(body.square_card_nonce).trim()
          ? String(body.square_card_nonce).trim()
          : '';

      let payment; //set the payment to null
      let squarePaymentId; //set the square payment id to null
      //Try to create the API card payment
      try {
        const created = await createApiCardPayment({
          amountDollars: breakdown.grand_total, //Set the amount dollars to the grand total
          idempotencyKeySuffix: idempotencyKey, //Set the idempotency key suffix to the idempotency key
          note: `EmmasEnvy POS appointment ${appointmentId}`, //Set the note to the appointment id
          sourceId: squareCardNonce || undefined, //Set the source id to the square card nonce
        });
        payment = created.payment; //Set the payment to the payment
        squarePaymentId = created.squarePaymentId; //Set the square payment id to the square payment id
      } catch (e) {
        await client.query('ROLLBACK'); //Await for the query to rollback the transaction
        console.error('[POS] charge-card-api Square createApiCardPayment', e); //Log the error
        //Set the message to the error message
        const msg =
          e.body && e.body.errors && e.body.errors[0]
            ? e.body.errors[0].detail || e.body.errors[0].code
            : e.message || 'Square Payments API failed';
        return res.status(400).json({ error: String(msg) });
      }

      //Finalize the card payment
      return finalizePosCardPayment(res, client, {
        appointmentId, //Set the appointment id to the appointment id
        body, //Set the body to the body
        payment, //Set the payment to the payment
        breakdown, //Set the breakdown to the breakdown
        ctx, //Set the context to the context
        disc, //Set the discounts to the discounts
        idempotencyKey, //Set the idempotency key to the idempotency key
        squarePaymentId, //Set the square payment id to the square payment id
        tip, //Set the tip to the tip
      });
    } catch (err) {
      await client.query('ROLLBACK'); //Await for the query to rollback the transaction
      throw err;
    } finally {
      client.release(); //Release the client
    }
  } catch (err) {
    console.error('[POS] POST /charge-card-api error', err); //Log the error
    return next(err);
  }
});

//Post API route to record the payment
router.post('/record-payment', requireAuth, async (req, res, next) => {
  //Try to record the payment
  try {
    const body = req.body || {}; //set the body to the body from the request
    const appointmentId = body.appointmentId != null ? parseInt(body.appointmentId, 10) : null; //set the appointment id to the appointment id from the body
    const paymentMethod = body.paymentMethod === 'cash' || body.paymentMethod === 'card' ? body.paymentMethod : 'cash';
    const rewardOfferingId = body.reward_offering_id != null ? parseInt(body.reward_offering_id, 10) : null; //set the reward offering id to the reward offering id from the body
    const rawPromoCode = body.promoCode != null ? String(body.promoCode).trim() : ''; //set the raw promo code to the promo code from the body
    const bodyPromoId = body.promo_code_id != null ? parseInt(body.promo_code_id, 10) : null; //set the body promo id to the promo id from the body
    const tip = body.tip != null ? Number(body.tip) : 0; //set the tip to the tip from the body
    const idempotencyKey = body.checkout_idempotency_key != null ? String(body.checkout_idempotency_key).trim() : ''; //set the idempotency key to the idempotency key from the body

    //If the payment method is card, then return an error
    if (paymentMethod === 'card') {
      return res.status(400).json({ error: 'Use POST /api/pos/complete-card for card payments' }); //Return an error response
    }

    //If the tip is not a number or is less than 0, then return an error
    if (Number.isNaN(tip) || tip < 0) {
      return res.status(400).json({ error: 'tip must be a non-negative number' }); //Return an error response
    }

    const now = new Date(); //set the now to the current date and time

    //If the appointment id is not null and not a number, then return an error
    if (appointmentId != null && !Number.isNaN(appointmentId)) {
      const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : ''; //set the role to the role from the request
      //If the role is not an admin or IT, then return an error
      if (!canPosCheckout(role)) {
        return res.status(403).json({ error: 'Admin or IT access required to check out appointments' }); //Return an error response
      }

      const client = await db.pool.connect(); //connect to the database
      try {
        await client.query('BEGIN'); //BEGIN is the function to begin the transaction

        const ctx = await loadPosAppointmentContext(client, appointmentId); //await for the query to load the appointment context
        //If the context has an error, then return an error
        if (ctx.error) {
          await client.query('ROLLBACK'); //Await for the query to rollback the transaction
          return res.status(ctx.status).json({ error: ctx.error });
        }

        const disc = await resolveCheckoutDiscounts(client, ctx, body); //await for the query to resolve the checkout discounts
        //If the discounts have an error, then return an error
        if (disc.error) {
          await client.query('ROLLBACK'); //Await for the query to rollback the transaction
          return res.status(disc.status).json({ error: disc.error }); //Return an error response
        }

        //Compute the checkout breakdown
        const breakdown = computeCheckoutBreakdown({
          serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
          promoRow: disc.promoRow, //Set the promo row to the promo row
          rewardRow: disc.rewardRow, //Set the reward row to the reward row
          tip, //Set the tip to the tip
        });
        //Set the promo key to the promo code from the body 
        const promoKey = body.promoCode
          ? normalizePromoCode(String(body.promoCode))
          : body.promo_code_id != null
            ? `id:${body.promo_code_id}`
            : '';
        //Set the reward id to the reward offering id from the body
        const rewardIdForKey =
          body.reward_offering_id != null && !Number.isNaN(parseInt(body.reward_offering_id, 10))
            ? parseInt(body.reward_offering_id, 10)
            : null;
        //Build the idempotency key
        const expectedKey = buildIdempotencyKey({
          appointmentId, //Set the appointment id to the appointment id
          serviceSubtotal: ctx.serviceSubtotal, //Set the service subtotal to the service subtotal
          promo: promoKey, //Set the promo key to the promo key
          reward_offering_id: rewardIdForKey, //Set the reward id to the reward id
          tip: roundMoney(tip), //Set the tip to the tip
        });
        //If the idempotency key does not match the expected key, then return an error
        if (!idempotencyKey || idempotencyKey !== expectedKey) {
          await client.query('ROLLBACK'); //Await for the query to rollback the transaction
          return res.status(400).json({ error: 'checkout_idempotency_key must match POST /api/pos/preview for these options' });
        }

        const totalAmount = breakdown.grand_total; //Set the total amount to the grand total
        const amountReceived = body.amountReceived != null ? Number(body.amountReceived) : null; //Set the amount received to the amount received from the body
        //If the amount received is null or not a number, then return an error
        if (amountReceived == null || Number.isNaN(amountReceived)) {
          await client.query('ROLLBACK'); //Await for the query to rollback the transaction
          return res.status(400).json({ error: 'amountReceived is required for cash' });
        }
        //If the amount received is less than the total amount, then return an error
        if (amountReceived + 0.02 < totalAmount) {
          await client.query('ROLLBACK'); //Await for the query to rollback the transaction
          return res.status(400).json({ error: 'Amount received is less than total due' });
        }
        const expChange = roundMoney(amountReceived - totalAmount); //Set the expected change to the amount received minus the total amount
        //Set the wants promo to the raw promo code or the body promo id
        const wantsPromo =
          (rawPromoCode && normalizePromoCode(rawPromoCode)) || (bodyPromoId != null && !Number.isNaN(bodyPromoId)); //This checks if the user wants to use a promo code by code or by id
        //If the user wants to use a promo code and the customer id is not null, then redeem the promo code
        if (wantsPromo && ctx.customerId != null) {
          let promoRow; //set the promo row to null
          //If the user wants to use a promo code by code, then select the promo code by code
          if (rawPromoCode) {
            promoRow = await selectPromoByCode(client, normalizePromoCode(rawPromoCode));//await for the query to select the promo code by code
          }
          //Else if the user wants to use a promo code by id, then select the promo code by id
          else {
            promoRow = await selectPromoById(client, bodyPromoId); //await for the query to select the promo code by id
          }
          //Try to redeem the promo code
          try {
            await redeemPromo(client, promoRow.id, ctx.customerId); //await for the query to redeem the promo code
          } catch (redeemErr) {
            await client.query('ROLLBACK'); //Await for the query to rollback the transaction
            const code = redeemErr.statusCode === 400 ? 400 : 500; //Set the code to the status code
            return res.status(code).json({ error: redeemErr.message || 'Promo redemption failed' }); //Return an error response
          }
        }

        let rewardPointsUsed = null; //set the reward points used to null
        //If the reward offering id is not null and not a number and the customer id is not null and the reward row is not null, then update the user's reward points
        if (rewardOfferingId != null && !Number.isNaN(rewardOfferingId) && ctx.customerId != null && disc.rewardRow) {
          const pointCost = parseInt(disc.rewardRow.point_cost, 10) || 0; //Set the point cost to the point cost from the reward row
          rewardPointsUsed = pointCost; //Set the reward points used to the point cost
          //Update the user's reward points
          await client.query(
            `UPDATE ${USERS_TABLE} SET reward_points = GREATEST(0, COALESCE(reward_points, 0) - $1) WHERE id = $2`,
            [pointCost, ctx.customerId] //Set the customer id to the customer id
          );
        }

        const invoiceId = ctx.invoiceId; //Set the invoice id to the invoice id from the context
        const cashSnapshot = { breakdown, payment_method: 'cash' }; //Set the cash snapshot to the breakdown and payment method

        //Update the invoice
        await client.query(
          `UPDATE ${INVOICES_TABLE}
           SET total_amount = $1,
               payment_method = $2,
               payment_status = $3,
               updated_at = $4,
               amount_received = $5,
               change_due = $6,
               reward_offering_id = $7,
               reward_points_used = $8,
               tip_amount = $9,
               square_payment_id = NULL,
               checkout_idempotency_key = $10,
               checkout_snapshot = $11::jsonb
           WHERE id = $12`,
          [
            totalAmount,
            'cash',
            'Paid',
            now,
            amountReceived,
            expChange,
            rewardOfferingId,
            rewardPointsUsed,
            roundMoney(tip),
            idempotencyKey,
            cashSnapshot,
            invoiceId,
          ]
        );

        //Update the appointment status to paid
        await client.query(`UPDATE ${APPOINTMENTS_TABLE} SET status = $1, paid_at = $2 WHERE id = $3`, [
          STATUS_PAID,
          now,
          appointmentId,
        ]);

        const customerId = ctx.customerId; //Set the customer id to the customer id from the context
        let pointsAwarded = 0; //Set the points awarded to 0
        //If the customer id is not null, then award the points to the customer
        if (customerId != null) {
          pointsAwarded = Math.floor(totalAmount * POINTS_PER_DOLLAR); //Set the points awarded to the total amount multiplied by the points per dollar
          //If the points awarded is greater than 0, then award the points to the customer
          if (pointsAwarded > 0) {
            //Update the user's reward points
            await client.query(`UPDATE ${USERS_TABLE} SET reward_points = COALESCE(reward_points, 0) + $1 WHERE id = $2`, [
              pointsAwarded, //Set the points awarded to the points awarded
              customerId, //Set the customer id to the customer id
            ]);
            //Update the invoice's points awarded
            await client.query(`UPDATE ${INVOICES_TABLE} SET points_awarded = $1 WHERE id = $2`, [pointsAwarded, invoiceId]);
          }
        }

        let customerRewardPointsAfter = null; //set the customer reward points after to null
        //If the customer id is not null, then get the customer's reward points after
        if (customerId != null) {
          const prAfter = await client.query(`SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`, [customerId]); //await for the query to get the customer's reward points after
          //Set the customer reward points after to the customer's reward points
          customerRewardPointsAfter =
            prAfter.rows[0]?.reward_points != null ? parseInt(prAfter.rows[0].reward_points, 10) : 0;
        }

        await client.query('COMMIT'); //COMMIT is the function to commit the transaction
        //Return the success response
        return res.json({
          success: true, //Set the success to true
          invoiceId, //Set the invoice id to the invoice id
          points_awarded: pointsAwarded, //Set the points awarded to the points awarded
          customer_reward_points: customerRewardPointsAfter, //Set the customer reward points after to the customer reward points after
          payment_method: 'cash', //Set the payment method to cash
          grand_total: totalAmount, //Set the grand total to the total amount
          amount_received: amountReceived, //Set the amount received to the amount received
          change_due: expChange, //Set the change due to the expected change
        });
      } catch (err) {
        await client.query('ROLLBACK'); //ROLLBACK is the function to rollback the transaction
        throw err; //Throw the error
      } finally {
        client.release(); //Release the client
      }
    }

    return res.status(400).json({ error: 'appointmentId is required.' }); //Return an error response
  } catch (err) {
    console.error('[POS] POST /record-payment error', err); //Log the error
    return next(err); //Pass the error to the next middleware
  }
});

module.exports = router;
