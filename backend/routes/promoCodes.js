const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module
const { requireAuth, requireAdminOrIT } = require('../middleware/auth');
const {
  normalizePromoCode, // Import the normalizePromoCode function
  selectPromoByCode, // Import the selectPromoByCode function
  selectPromoById, // Import the selectPromoById function
  getUserUsedPromoCodes, // Import the getUserUsedPromoCodes function
  promoEligibilityError, // Import the promoEligibilityError function
} = require('../lib/promoRedemption');
const router = express.Router(); // Create a new router
const TABLE = 'emmasenvy.promo_codes'; // Define the table name
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type'; // Define the service type table name
const DISCOUNT_TYPES = ['percentage', 'flat_amount']; // Define the discount types

/* This file is the backend route for the promo codes. It is used to create, update, and delete promo codes. */ 

function rowToPromoCode(row) { // Define the rowToPromoCode function
  if (!row) return null; // If the row is not found, return null
  // Return the promo code object
  return {
    id: row.id, // Get the id from the row
    code: row.code, // Get the code from the row
    discount_type: row.discount_type, // Get the discount type from the row
    discount_value: Number(row.discount_value), // Get the discount value from the row
    min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : 0, // Get the minimum purchase amount from the row
    expiration_date: row.expiration_date, // Get the expiration date from the row
    usage_limit: row.usage_limit != null ? row.usage_limit : null, // Get the usage limit from the row
    current_usage_count: row.current_usage_count != null ? row.current_usage_count : 0, // Get the current usage count from the row
    is_active: row.is_active === true, // Get the is active from the row
    created_at: row.created_at, // Get the created at from the row
    service_type_id: row.service_type_id != null ? Number(row.service_type_id) : null, // Get the service type id from the row
  };
}

// Define the assertServiceTypeExists function to check if the service type exists
async function assertServiceTypeExists(serviceTypeId) {
  if (serviceTypeId == null) return; // If the service type id is not found, return
  const r = await db.pool.query(`SELECT 1 FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`, [serviceTypeId]); // Execute the query to check if the service type exists
  // If the service type does not exist, return an error
  if (r.rows.length === 0) {
    const err = new Error('service_type_id does not exist'); // Create a new error
    err.statusCode = 400; // Set the status code to 400
    throw err; // Throw the error
  }
}

// GET /api/promo-codes – list all (admin / IT) // List all promo codes for the admin and IT roles
router.get('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to get the promo codes
  try {
    const result = await db.pool.query(
      `SELECT id, code, discount_type, discount_value, min_purchase_amount,
              expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id
       FROM ${TABLE}
       ORDER BY created_at DESC, id DESC`
    );
    const promo_codes = result.rows.map(rowToPromoCode); // Map the rows to promo code objects
    return res.json({ promo_codes }); // Return the promo codes as a JSON object
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// GET /api/promo-codes/validate?code=XXX&subtotal=YYY&service_type_id=ZZZ – validate for POS / checkout *****This route is not yet implemented in the frontend*****
router.get('/validate', requireAuth, async (req, res, next) => {
  try {
    const code = (req.query.code && String(req.query.code).trim()) || ''; // Get the code from the request query
    const normalizedCode = normalizePromoCode(code); // Normalize the code
    if (!normalizedCode) return res.status(400).json({ error: 'Code is required' }); // If the code is not found, return a 400 error
    const subtotal = parseFloat(req.query.subtotal); // Get the subtotal from the request query
    if (Number.isNaN(subtotal) || subtotal < 0) return res.status(400).json({ error: 'Valid subtotal is required' }); // If the subtotal is not a number or is less than 0, return a 400 error
    // Get the service type id from the request query
    const serviceTypeId =
      req.query.service_type_id != null && String(req.query.service_type_id).trim() !== ''
        ? parseInt(req.query.service_type_id, 10)
        : null;
    // If the service type id is not a number, return a 400 error
    if (req.query.service_type_id != null && req.query.service_type_id !== '' && Number.isNaN(serviceTypeId)) { // If the service type id is not a number, return a 400 error
      return res.status(400).json({ error: 'Invalid service_type_id' }); // If the service type id is not a number, return a 400 error
    }
    const row = await selectPromoByCode(db.pool, normalizedCode);
    let customerIdForPromo = req.user?.id ?? null;
    const rawCustomerId = req.query.customer_id != null && String(req.query.customer_id).trim() !== '' ? parseInt(req.query.customer_id, 10) : null;
    if (rawCustomerId != null && !Number.isNaN(rawCustomerId)) {
      const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';
      if (role !== 'admin' && role !== 'it') {
        return res.status(403).json({ error: 'Admin or IT access required to validate a promo for another customer' });
      }
      customerIdForPromo = rawCustomerId;
    }
    const usedPromoIds =
      customerIdForPromo != null ? await getUserUsedPromoCodes(db.pool, customerIdForPromo) : [];
    // Check if the promo code is eligible
    const errMsg = promoEligibilityError(row, {
      subtotal, // Get the subtotal from the request query
      serviceTypeId, // Get the service type id from the request query
      usedPromoIds, // Get the used promo ids from the database
    });
    // If the promo code is not eligible, return a 400 error
    if (errMsg) {
      const status = errMsg === 'Invalid or expired code' ? 404 : 400; // If the promo code is invalid or expired, return a 404 error
      return res.status(status).json({ error: errMsg }); // If the promo code is not eligible, return a 400 error
    }
    const discountValue = Number(row.discount_value); // Get the discount value from the row
    return res.json({ // Return the discount type and discount value as a JSON object
      discount_type: row.discount_type, // Get the discount type from the row
      discount_value: discountValue, // Get the discount value from the row
    });
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// POST /api/promo-codes – create (admin / IT)
router.post('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to create a new promo code
  try {
    const {
      code, // Get the code from the request body
      discount_type, // Get the discount type from the request body
      discount_value, // Get the discount value from the request body
      min_purchase_amount, // Get the minimum purchase amount from the request body
      expiration_date, // Get the expiration date from the request body
      usage_limit, // Get the usage limit from the request body
      is_active, // Get the is active from the request body
      service_type_id, // Get the service type id from the request body
    } = req.body;
    const rawCode = (code && String(code).trim()) || ''; // Get the raw code from the request body
    const normalizedCode = normalizePromoCode(rawCode); // Normalize the code
    if (!normalizedCode) return res.status(400).json({ error: 'Code is required' }); // If the code is not found, return a 400 error
    const dt = discount_type === 'percent' ? 'percentage' : discount_type === 'fixed' ? 'flat_amount' : discount_type; // Get the discount type from the request body
    if (!DISCOUNT_TYPES.includes(dt)) return res.status(400).json({ error: 'Invalid discount_type; use percentage or flat_amount' }); // If the discount type is not valid, return a 400 error
    const value = parseFloat(discount_value); // Get the discount value from the request body
    if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: 'discount_value must be a positive number' }); // If the discount value is not a number or is less than 0, return a 400 error
    if (dt === 'percentage' && value > 100) return res.status(400).json({ error: 'Percentage discount cannot exceed 100' }); // If the discount value is greater than 100, return a 400 error
    const minPurchase = min_purchase_amount != null ? parseFloat(min_purchase_amount) : 0; // Get the minimum purchase amount from the request body
    if (Number.isNaN(minPurchase) || minPurchase < 0) return res.status(400).json({ error: 'min_purchase_amount must be 0 or greater' }); // If the minimum purchase amount is not a number or is less than 0, return a 400 error
    const usageLimit = usage_limit == null || usage_limit === '' ? null : parseInt(usage_limit, 10); // Get the usage limit from the request body
    if (usage_limit != null && usage_limit !== '' && (Number.isNaN(usageLimit) || usageLimit < 0)) { // If the usage limit is not a number or is less than 0, return a 400 error
      return res.status(400).json({ error: 'usage_limit must be a non-negative integer or null' }); // If the usage limit is not a number or is less than 0, return a 400 error
    }
    const expDate = expiration_date && String(expiration_date).trim() ? new Date(expiration_date) : null; // Get the expiration date from the request body
    const active = is_active !== false; // Get the is active from the request body
    const svcId = service_type_id == null || service_type_id === '' ? null : parseInt(service_type_id, 10); // Get the service type id from the request body
    // If the service type id is not a number, return a 400 error
    if (service_type_id != null && service_type_id !== '' && Number.isNaN(svcId)) {
      return res.status(400).json({ error: 'Invalid service_type_id' }); // If the service type id is not a number, return a 400 error
    }
    await assertServiceTypeExists(svcId); // Check if the service type exists
    // Execute the query to create the promo code
    const result = await db.pool.query(
      `INSERT INTO ${TABLE}
       (code, discount_type, discount_value, min_purchase_amount, expiration_date, usage_limit, is_active, service_type_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, code, discount_type, discount_value, min_purchase_amount,
                 expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id`,
      [normalizedCode, dt, value, minPurchase, expDate, usageLimit, active, svcId]
    );
    return res.status(201).json({ promo_code: rowToPromoCode(result.rows[0]) }); // Return the promo code as a JSON object
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A promo code with this code already exists' }); // If the promo code already exists, return a 409 error
    if (err.statusCode === 400) return res.status(400).json({ error: err.message }); // If the promo code is not valid, return a 400 error
    return next(err); // If there is an error, return the error
  }
});

// PATCH /api/promo-codes/:id – update (admin / IT); do not allow changing code
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to update the promo code
  try {
    const id = parseInt(req.params.id, 10); // Get the id from the request params
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    const { discount_type, discount_value, min_purchase_amount, expiration_date, usage_limit, is_active, service_type_id } = req.body; // Get the discount type, discount value, minimum purchase amount, expiration date, usage limit, is active, and service type id from the request body
    const updates = []; // Initialize the updates array
    const values = []; // Initialize the values array
    let idx = 1; // Initialize the index to 1
    // If the discount type is not undefined, add it to the updates and values
    if (discount_type !== undefined) {
      const dt = discount_type === 'percent' ? 'percentage' : discount_type === 'fixed' ? 'flat_amount' : discount_type; // Get the discount type from the request body
      if (!DISCOUNT_TYPES.includes(dt)) return res.status(400).json({ error: 'Invalid discount_type' }); // If the discount type is not valid, return a 400 error
      updates.push(`discount_type = $${idx++}`); // Add the discount type to the updates array
      values.push(dt); // Add the discount type to the values array
    }
    // If the discount value is not undefined, add it to the updates and values
    if (discount_value !== undefined) {
      const value = parseFloat(discount_value); // Get the discount value from the request body
      if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: 'discount_value must be positive' }); // If the discount value is not a number or is less than 0, return a 400 error
      updates.push(`discount_value = $${idx++}`); // Add the discount value to the updates array
      values.push(value); // Add the discount value to the values array
    }
    // If the minimum purchase amount is not undefined, add it to the updates and values
    if (min_purchase_amount !== undefined) {
      const minPurchase = parseFloat(min_purchase_amount); // Get the minimum purchase amount from the request body
      if (Number.isNaN(minPurchase) || minPurchase < 0) return res.status(400).json({ error: 'min_purchase_amount must be >= 0' }); // If the minimum purchase amount is not a number or is less than 0, return a 400 error
      updates.push(`min_purchase_amount = $${idx++}`); // Add the minimum purchase amount to the updates array
      values.push(minPurchase); // Add the minimum purchase amount to the values array
    }
    // If the expiration date is not undefined, add it to the updates and values
    if (expiration_date !== undefined) {
      const expDate = expiration_date === null || expiration_date === '' ? null : new Date(expiration_date); // Get the expiration date from the request body
      updates.push(`expiration_date = $${idx++}`); // Add the expiration date to the updates array
      values.push(expDate); // Add the expiration date to the values array
    }
    // If the usage limit is not undefined, add it to the updates and values
    if (usage_limit !== undefined) {
      const usageLimit = usage_limit === null || usage_limit === '' ? null : parseInt(usage_limit, 10); // Get the usage limit from the request body
      // If the usage limit is not a number or is less than 0, return a 400 error
      if (usage_limit !== null && usage_limit !== '' && (Number.isNaN(usageLimit) || usageLimit < 0)) {
        return res.status(400).json({ error: 'usage_limit must be non-negative integer or null' }); // If the usage limit is not a number or is less than 0, return a 400 error
      }
      updates.push(`usage_limit = $${idx++}`); // Add the usage limit to the updates array
      values.push(usageLimit); // Add the usage limit to the values array
    }
    // If the is active is not undefined, add it to the updates and values
    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${idx++}`); // Add the is active to the updates array
      values.push(is_active); // Add the is active to the values array
    }
    // If the service type id is not undefined, add it to the updates and values
    if (service_type_id !== undefined) {
      // Get the service type id from the request body
      const svcId = 
        service_type_id === null || service_type_id === '' ? null : parseInt(service_type_id, 10);
      // If the service type id is not a number, return a 400 error
      if (service_type_id != null && service_type_id !== '' && Number.isNaN(svcId)) {
        return res.status(400).json({ error: 'Invalid service_type_id' }); // If the service type id is not a number, return a 400 error
      }
      await assertServiceTypeExists(svcId); // Check if the service type exists
      updates.push(`service_type_id = $${idx++}`); // Add the service type id to the updates array
      values.push(svcId); // Add the service type id to the values array
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' }); // If there are no fields to update, return a 400 error
    values.push(id); // Add the id to the values array
    // Execute the query to update the promo code
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, code, discount_type, discount_value, min_purchase_amount,
                 expiration_date, usage_limit, current_usage_count, is_active, created_at, service_type_id`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promo code not found' }); // If the promo code is not found, return a 404 error
    return res.json({ promo_code: rowToPromoCode(result.rows[0]) }); // Return the promo code as a JSON object
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message }); // If the promo code is not valid, return a 400 error
    return next(err); // If there is an error, return the error
  }
});

// DELETE /api/promo-codes/:id – delete (admin / IT)
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to delete the promo code
  try {
    const id = parseInt(req.params.id, 10); // Get the id from the request params
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]); // Execute the query to delete the promo code
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promo code not found' }); // If the promo code is not found, return a 404 error
    return res.status(204).send(); // Return a 204 status
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

module.exports = router;
