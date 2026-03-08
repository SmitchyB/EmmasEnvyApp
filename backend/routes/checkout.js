/**
 * Storefront checkout: create invoice from cart (logged-in or guest), mark as paid, optional shipping.
 * POST /api/checkout – optionalAuth. Body: deliveryOrPickup, address?, saveAddress?, guestInfo?, cartItems? (guest only).
 */

const express = require('express');
const db = require('../lib/db');
const { optionalAuth } = require('../middleware/auth');
const { DEFAULT_CURRENCY, SHIPPING_COST, POINTS_PER_DOLLAR } = require('../lib/constants');

const router = express.Router();
const INVOICES_TABLE = 'emmasenvy.invoices';
const INVOICE_ITEMS_TABLE = 'emmasenvy.invoice_items';
const USER_ADDRESSES_TABLE = 'emmasenvy.user_addresses';
const USERS_CART_TABLE = 'emmasenvy.users_cart';
const USERS_TABLE = 'emmasenvy.users';
const PRODUCTS_TABLE = 'emmasenvy.products';
const VARIANTS_TABLE = 'emmasenvy.product_variants';
const INVOICE_ITEM_TYPE_PRODUCT = process.env.INVOICE_ITEM_TYPE_PRODUCT || 'Product';
const REWARD_OFFERINGS_TABLE = 'emmasenvy.reward_offerings';

function generateStorefrontInvoiceId(dateStr) {
  const datePart = (dateStr || '').replace(/-/g, '').slice(0, 8) || '00000000';
  return `SF-${datePart}`;
}

router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const settings = await db.getSiteSettings();
    if (settings && settings.products_enabled === false) {
      return res.status(403).json({ error: 'Products are currently disabled.' });
    }
    const body = req.body || {};
    const deliveryOrPickup = body.deliveryOrPickup === 'delivery' ? 'delivery' : 'pickup';
    const addressPayload = body.address && typeof body.address === 'object' ? body.address : null;
    const saveAddress = !!body.saveAddress;
    const guestInfo = body.guestInfo && typeof body.guestInfo === 'object' ? body.guestInfo : null;
    const cartItems = Array.isArray(body.cartItems) ? body.cartItems : [];
    const rewardOfferingId = body.reward_offering_id != null ? parseInt(body.reward_offering_id, 10) : null;

    const user = req.user || null;
    let lines = [];

    if (user) {
      const items = await db.getCartByUserId(user.id);
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Your cart is empty' });
      }
      lines = items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: Math.max(1, Number(it.quantity) || 1),
        title: it.title || 'Product',
        price: Number(it.price) || 0,
      }));
    } else {
      if (!guestInfo || !guestInfo.fullName || !guestInfo.email) {
        return res.status(400).json({ error: 'Guest checkout requires guestInfo with fullName and email' });
      }
      if (!cartItems.length) {
        return res.status(400).json({ error: 'Cart is empty' });
      }
      for (const it of cartItems) {
        const productId = parseInt(it.productId, 10);
        const variantId = it.variantId != null ? parseInt(it.variantId, 10) : null;
        const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
        if (Number.isNaN(productId) || productId <= 0) continue;
        const row = await db.pool.query(
          variantId != null
            ? `SELECT p.title, p.price AS product_price, p.image AS product_image, v.price AS variant_price, v.image AS variant_image
               FROM ${PRODUCTS_TABLE} p
               LEFT JOIN ${VARIANTS_TABLE} v ON v.product_id = p.id AND v.id = $2
               WHERE p.id = $1`
            : `SELECT p.title, p.price AS product_price, p.image AS product_image, NULL::numeric AS variant_price, NULL AS variant_image
               FROM ${PRODUCTS_TABLE} p WHERE p.id = $1`,
          variantId != null ? [productId, variantId] : [productId]
        );
        const r = row.rows[0];
        if (!r) continue;
        const price = Number(r.variant_price ?? r.product_price) || 0;
        const title = (r.title && String(r.title).trim()) || 'Product';
        lines.push({ productId, variantId: variantId || undefined, quantity, title, price });
      }
      if (lines.length === 0) {
        return res.status(400).json({ error: 'No valid cart items' });
      }
    }

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const shipping = deliveryOrPickup === 'delivery' ? SHIPPING_COST : 0;
    let totalAmount = subtotal + shipping;

    let rewardPointsUsed = null;
    let rewardDiscountAmount = 0;
    let freeProductLine = null;
    if (user && rewardOfferingId != null && !Number.isNaN(rewardOfferingId)) {
      const offResult = await db.pool.query(
        `SELECT id, title, reward_type, point_cost, value, product_id, min_purchase_amount, is_active
         FROM ${REWARD_OFFERINGS_TABLE} WHERE id = $1`,
        [rewardOfferingId]
      );
      const offering = offResult.rows[0];
      if (!offering || !offering.is_active) {
        return res.status(400).json({ error: 'Invalid or inactive reward' });
      }
      const userRow = await db.pool.query(
        `SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`,
        [user.id]
      );
      const userPoints = userRow.rows[0]?.reward_points != null ? parseInt(userRow.rows[0].reward_points, 10) : 0;
      const pointCost = parseInt(offering.point_cost, 10) || 0;
      if (userPoints < pointCost) {
        return res.status(400).json({ error: 'Not enough points for this reward' });
      }
      const minPurchase = offering.min_purchase_amount != null ? Number(offering.min_purchase_amount) : 0;
      if (subtotal < minPurchase) {
        return res.status(400).json({ error: `Minimum purchase of $${minPurchase.toFixed(2)} required for this reward` });
      }
      rewardPointsUsed = pointCost;
      if (offering.reward_type === 'percent_off') {
        const pct = Number(offering.value) || 0;
        rewardDiscountAmount = Math.min((subtotal * pct) / 100, subtotal);
      } else if (offering.reward_type === 'dollar_off') {
        rewardDiscountAmount = Math.min(Number(offering.value) || 0, subtotal);
      } else if (offering.reward_type === 'free_product' && offering.product_id) {
        const prodRow = await db.pool.query(
          `SELECT id, title, price FROM ${PRODUCTS_TABLE} WHERE id = $1`,
          [offering.product_id]
        );
        if (prodRow.rows[0]) {
          const p = prodRow.rows[0];
          freeProductLine = { productId: p.id, variantId: undefined, quantity: 1, title: (p.title || 'Free Product') + ' (reward)', price: 0 };
          rewardDiscountAmount = Number(p.price) || 0;
        }
      }
      totalAmount = Math.max(0, totalAmount - rewardDiscountAmount);
    }

    let addressId = null;
    if (deliveryOrPickup === 'delivery') {
      if (!addressPayload) {
        return res.status(400).json({ error: 'Delivery requires an address' });
      }
      if (addressPayload.addressId != null) {
        const aid = parseInt(addressPayload.addressId, 10);
        if (!Number.isNaN(aid) && user) {
          const addr = await db.pool.query(
            `SELECT id FROM ${USER_ADDRESSES_TABLE} WHERE id = $1 AND user_id = $2`,
            [aid, user.id]
          );
          if (addr.rows[0]) addressId = addr.rows[0].id;
        }
        if (addressId == null && user) {
          return res.status(400).json({ error: 'Saved address not found' });
        }
      }
      if (addressId == null) {
        const full_name = addressPayload.full_name != null ? String(addressPayload.full_name).trim() : '';
        const address_line_1 = addressPayload.address_line_1 != null ? String(addressPayload.address_line_1).trim() : '';
        const city = addressPayload.city != null ? String(addressPayload.city).trim() : '';
        const state_province = addressPayload.state_province != null ? String(addressPayload.state_province).trim() : '';
        const zip_postal_code = addressPayload.zip_postal_code != null ? String(addressPayload.zip_postal_code).trim() : '';
        if (!full_name || !address_line_1 || !city || !state_province || !zip_postal_code) {
          return res.status(400).json({
            error: 'Address must include full_name, address_line_1, city, state_province, zip_postal_code',
          });
        }
        const now = new Date();
        const userIdForAddress = user && saveAddress ? user.id : null;
        const ins = await db.pool.query(
          `INSERT INTO ${USER_ADDRESSES_TABLE} (user_id, full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
           RETURNING id`,
          [
            userIdForAddress,
            full_name,
            address_line_1,
            addressPayload.address_line_2 != null ? String(addressPayload.address_line_2).trim() : null,
            city,
            state_province,
            zip_postal_code,
            addressPayload.country != null ? String(addressPayload.country).trim() || null : null,
            now,
          ]
        );
        addressId = ins.rows[0].id;
      }
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const prefix = generateStorefrontInvoiceId(today);
    const countResult = await db.pool.query(
      `SELECT COUNT(*) AS c FROM ${INVOICES_TABLE} WHERE invoice_id LIKE $1`,
      [prefix + '%']
    );
    const n = (parseInt(countResult.rows[0].c, 10) || 0) + 1;
    const humanInvoiceId = `${prefix}-${n}`;

    const customerId = user ? user.id : null;
    const name = user
      ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || 'Customer'
      : (guestInfo.fullName && String(guestInfo.fullName).trim()) || 'Guest';
    const email = user ? (user.email || '') : (guestInfo.email && String(guestInfo.email).trim()) || '';
    const phone = user ? (user.phone || '') : (guestInfo.phone && String(guestInfo.phone).trim()) || '';

    const shipOrder = deliveryOrPickup === 'delivery';
    const shippingStatus = shipOrder ? 'pending' : null;

    if (rewardPointsUsed != null && rewardPointsUsed > 0 && user) {
      await db.pool.query(
        `UPDATE ${USERS_TABLE} SET reward_points = GREATEST(0, COALESCE(reward_points, 0) - $1) WHERE id = $2`,
        [rewardPointsUsed, user.id]
      );
    }

    const invResult = await db.pool.query(
      `INSERT INTO ${INVOICES_TABLE} (
        invoice_id, customer_id, name, email, phone, created_by, total_amount, currency,
        payment_status, payment_method, status, ship_order, address_id, shipping_status,
        created_at, updated_at, amount_received, change_due, reward_offering_id, reward_points_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14, $14, $7, 0, $15, $16)
      RETURNING id, invoice_id`,
      [
        humanInvoiceId,
        customerId,
        name,
        email,
        phone || null,
        customerId,
        totalAmount,
        DEFAULT_CURRENCY,
        'Paid',
        'card',
        shipOrder,
        addressId,
        shippingStatus,
        now,
        rewardOfferingId != null && !Number.isNaN(rewardOfferingId) ? rewardOfferingId : null,
        rewardPointsUsed,
      ]
    );
    const newInvoiceId = invResult.rows[0].id;
    const displayInvoiceId = invResult.rows[0].invoice_id;

    for (const line of lines) {
      await db.pool.query(
        `INSERT INTO ${INVOICE_ITEMS_TABLE} (invoice_id, item_id, item_type, title, price, quantity, image, assigned_employee, selected_variant)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7)`,
        [
          newInvoiceId,
          line.productId,
          INVOICE_ITEM_TYPE_PRODUCT,
          line.title,
          line.price,
          line.quantity,
          line.variantId != null ? String(line.variantId) : null,
        ]
      );
    }
    if (freeProductLine) {
      await db.pool.query(
        `INSERT INTO ${INVOICE_ITEMS_TABLE} (invoice_id, item_id, item_type, title, price, quantity, image, assigned_employee, selected_variant)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7)`,
        [
          newInvoiceId,
          freeProductLine.productId,
          INVOICE_ITEM_TYPE_PRODUCT,
          freeProductLine.title,
          0,
          freeProductLine.quantity,
          null,
        ]
      );
    }

    if (user) {
      await db.pool.query(`DELETE FROM ${USERS_CART_TABLE} WHERE user_id = $1`, [user.id]);
    }

    if (customerId != null) {
      const pointsAwarded = Math.floor(totalAmount * POINTS_PER_DOLLAR);
      if (pointsAwarded > 0) {
        await db.pool.query(
          `UPDATE ${USERS_TABLE} SET reward_points = COALESCE(reward_points, 0) + $1 WHERE id = $2`,
          [pointsAwarded, customerId]
        );
        await db.pool.query(
          `UPDATE ${INVOICES_TABLE} SET points_awarded = $1 WHERE id = $2`,
          [pointsAwarded, newInvoiceId]
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      invoiceId: newInvoiceId,
      invoice_id: displayInvoiceId,
    });
  } catch (err) {
    console.error('[checkout] POST / error', err);
    return next(err);
  }
});

module.exports = router;
