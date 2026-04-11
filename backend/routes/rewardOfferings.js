const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module
const { requireAuth, requireAdminOrIT } = require('../middleware/auth'); // Import the requireAuth and requireAdminOrIT middleware
const router = express.Router(); // Create a new router
const TABLE = 'emmasenvy.reward_offerings'; // Define the table name
const USERS_TABLE = 'emmasenvy.users'; // Define the users table name
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type'; // Define the service type table name
const REWARD_TYPES = ['percent_off', 'dollar_off', 'free_service']; // Define the reward types
const ACTIVE_TYPES_SQL = `r.reward_type IN ('percent_off', 'dollar_off', 'free_service')`; // Define the active types SQL
const SELECT_OFFERING_SQL = `r.id, r.title, r.reward_type, r.point_cost, r.value, r.min_purchase_amount, r.is_active, r.service_type_id, r.created_at, r.updated_at`; // Define the select offering SQL

/* This file is the backend route for the reward offerings. It is used to create, update, and delete reward offerings. */ 

// Define the assertServiceTypeExists function to check if the service type exists
async function assertServiceTypeExists(serviceTypeId) {
  if (serviceTypeId == null) return; // If service type id is not found, return
  const r = await db.pool.query(`SELECT 1 FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`, [serviceTypeId]); // Execute the query to check if the service type exists
  // If the service type does not exist, return an error
  if (r.rows.length === 0) {
    const err = new Error('service_type_id does not exist'); // Create a new error
    err.statusCode = 400; // Set the status code to 400
    throw err; // Throw the error
  }
}

// Define the offeringValidationError function to check if the offering is valid
function offeringValidationError(rewardType, valueNum, serviceTypeId) {
  // If the reward type is free service, return an error if the service type id is not found
  if (rewardType === 'free_service') {
    if (serviceTypeId == null) return 'free_service requires service_type_id'; // If the service type id is not found, return an error
    return null; // If the offering is valid, return null
  }
  // If the reward type is percent off or dollar off, return an error if the value is not found or is not a positive number
  if (rewardType === 'percent_off' || rewardType === 'dollar_off') {
    if (valueNum == null || Number.isNaN(valueNum) || valueNum <= 0) {
      return 'value is required and must be positive for percent_off and dollar_off'; // If the value is not found or is not a positive number, return an error
    }
    if (rewardType === 'percent_off' && valueNum > 100) return 'value cannot exceed 100 for percent_off'; // If the value exceeds 100, return an error
  }
  return null; // If the offering is valid, return null
}
// Define the rowToOffering function to convert the row to an offering object
function rowToOffering(row) {
  if (!row) return null; // If the row is not found, return null
  // Return the offering object
  return {
    id: row.id, // Get the id from the row
    title: row.title, // Get the title from the row
    reward_type: row.reward_type,
    point_cost: row.point_cost != null ? parseInt(row.point_cost, 10) : 0, // Get the point cost from the row
    value: row.value != null ? Number(row.value) : null, // Get the value from the row
    min_purchase_amount: row.min_purchase_amount != null ? Number(row.min_purchase_amount) : null, // Get the minimum purchase amount from the row
    is_active: row.is_active === true, // Get the is active from the row
    service_type_id: row.service_type_id != null ? Number(row.service_type_id) : null, // Get the service type id from the row
    created_at: row.created_at, // Get the created at from the row
    updated_at: row.updated_at, // Get the updated at from the row
  };
}
// Define the filterByServiceType function to filter the list by service type
function filterByServiceType(list, serviceTypeId) {
  if (serviceTypeId == null || Number.isNaN(serviceTypeId)) return list; // If the service type id is not found or is not a number, return the list
  return list.filter((o) => o.service_type_id == null || o.service_type_id === serviceTypeId); // Return the list filtered by service type
}

// GET /api/reward-offerings/customer-eligible?customerId=&subtotal=&service_type_id= - gets the customer eligible reward offerings
router.get('/customer-eligible', requireAuth, async (req, res, next) => {
  // Try to get the customer id, subtotal, and service type id
  try {
    const customerId = req.query.customerId != null ? parseInt(req.query.customerId, 10) : null; // Get the customer id from the query
    const subtotal = req.query.subtotal != null ? parseFloat(req.query.subtotal) : null; // Get the subtotal from the query
    const serviceTypeId = req.query.service_type_id != null ? parseInt(req.query.service_type_id, 10) : null; // Get the service type id from the query
    // If the customer id is not found or is not a number, return a 400 error
    if (customerId == null || Number.isNaN(customerId)) {
      return res.status(400).json({ error: 'customerId is required' }); // If the customer id is not found or is not a number, return a 400 error
    }
    // Select the user from the database
    const userRow = await db.pool.query(
      `SELECT reward_points FROM ${USERS_TABLE} WHERE id = $1`,
      [customerId]
    );
    const points = userRow.rows[0]?.reward_points != null ? parseInt(userRow.rows[0].reward_points, 10) : 0; // Get the points from the user
    // Select the reward offerings from the database
    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
       FROM ${TABLE} r
       WHERE r.is_active = true AND ${ACTIVE_TYPES_SQL} AND r.point_cost <= $1
       ORDER BY r.point_cost ASC, r.id ASC`,
      [points]
    );
    let list = result.rows.map(rowToOffering); // Let the list be the reward offerings
    // If the subtotal is not found or is not a number, filter the list by the subtotal
    if (subtotal != null && !Number.isNaN(subtotal)) {
      list = list.filter((o) => o.min_purchase_amount == null || o.min_purchase_amount <= subtotal); // Filter the list by the subtotal
    }
    list = filterByServiceType(list, serviceTypeId); // Filter the list by the service type`
    return res.json({ points, reward_offerings: list }); // Return the points and reward offerings as a JSON object
  } catch (err) {
    console.error('[rewardOfferings] GET /customer-eligible error', err); // Log the error
    return next(err); // If there is an error, return the error
  }
});

// GET /api/reward-offerings/available – active offerings; ?points= & ?subtotal= & ?service_type_id=
router.get('/available', async (req, res, next) => {
  // Try to get the points, subtotal, and service type id
  try {
    const points = req.query.points != null ? parseInt(req.query.points, 10) : null; // Get the points from the query
    const subtotal = req.query.subtotal != null ? parseFloat(req.query.subtotal) : null; // Get the subtotal from the query
    const serviceTypeId = req.query.service_type_id != null ? parseInt(req.query.service_type_id, 10) : null; // Get the service type id from the query
    // Select the reward offerings from the database
    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
       FROM ${TABLE} r
       WHERE r.is_active = true AND ${ACTIVE_TYPES_SQL}
       ORDER BY r.point_cost ASC, r.id ASC`
    );
    let list = result.rows.map(rowToOffering); // Let the list be the reward offerings
    // If the points is not found or is not a number, filter the list by the points
    if (points != null && !Number.isNaN(points)) {
      list = list.filter((o) => o.point_cost <= points); // Filter the list by the points
    }
    // If subtotal is not found or is not a number, filter the list by the subtotal
    if (subtotal != null && !Number.isNaN(subtotal)) {
      list = list.filter((o) => o.min_purchase_amount == null || o.min_purchase_amount <= subtotal); // Filter the list by the subtotal
    }
    list = filterByServiceType(list, serviceTypeId); // Filter the list by the service type
    return res.json({ reward_offerings: list }); // Return the reward offerings as a JSON object
  } catch (err) {
    console.error('[rewardOfferings] GET /available error', err); // Log the error
    return next(err); // If there is an error, return the error
  }
});

// GET /api/reward-offerings – list all (admin / IT)
router.get('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // Try to list all the reward offerings
  try {
    const result = await db.pool.query(
      `SELECT ${SELECT_OFFERING_SQL}
       FROM ${TABLE} r
       ORDER BY r.created_at DESC, r.id DESC`
    );
    const reward_offerings = result.rows.map(rowToOffering); // Let the reward offerings be the reward offerings
    return res.json({ reward_offerings }); // Return the reward offerings as a JSON object
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// POST /api/reward-offerings – create (admin / IT)
router.post('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // Try to create a new reward offering
  try {
    const { title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id } = req.body; // Get the title, reward type, point cost, value, minimum purchase amount, is active, and service type id from the body
    const titleStr = (title && String(title).trim()) || ''; // Get the title from the body
    if (!titleStr) return res.status(400).json({ error: 'title is required' }); // If the title is not found, return a 400 error
    const rt = (reward_type && String(reward_type).trim()) || ''; // Get the reward type from the body
    // If the reward type is not valid, return a 400 error
    if (!REWARD_TYPES.includes(rt)) {
      return res.status(400).json({ error: 'reward_type must be percent_off, dollar_off, or free_service' }); // If the reward type is not valid, return a 400 error
    }
    const cost = parseInt(point_cost, 10); // Get the point cost from the body
    if (Number.isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'point_cost must be a positive integer' }); // If the point cost is not a number or is less than 0, return a 400 error
    // Parse the service type id
    let serviceTypeIdParsed =
      service_type_id !== undefined && service_type_id !== null && service_type_id !== ''
        ? parseInt(service_type_id, 10)
        : null;
    // If the service type id is not a number, return a 400 error
    if (service_type_id !== undefined && service_type_id !== null && service_type_id !== '' && Number.isNaN(serviceTypeIdParsed)) {
      return res.status(400).json({ error: 'Invalid service_type_id' }); // If the service type id is not a number, return a 400 error
    }
    let valueNum = null; // Let the value number be null
    // If the reward type is percent off or dollar off, get the value from the body
    if (rt === 'percent_off' || rt === 'dollar_off') {
      valueNum = value != null && value !== '' ? parseFloat(value) : null; // If the value is not found or is not a number, return a 400 error
    } 
    // If the reward type is free service, get the value from the body
    else if (rt === 'free_service') {
      // If the value is not found or is not a number, return a 400 error
      if (value != null && value !== '') {
        valueNum = parseFloat(value); // Get the value from the body
        // If the value is not a number or is less than 0, return a 400 error
        if (Number.isNaN(valueNum) || valueNum < 0) {
          return res.status(400).json({ error: 'value must be non-negative for free_service if set' }); // If the value is not a number or is less than 0, return a 400 error
        }
      }
    }
    const offerErr = offeringValidationError(rt, valueNum, serviceTypeIdParsed); // Check if the offering is valid
    if (offerErr) return res.status(400).json({ error: offerErr }); // If the offering is not valid, return a 400 error
    await assertServiceTypeExists(serviceTypeIdParsed); // Check if the service type exists
    const minPurchase = min_purchase_amount != null && min_purchase_amount !== '' ? parseFloat(min_purchase_amount) : null; // Get the minimum purchase amount from the body
    // If the minimum purchase amount is not a number or is less than 0, return a 400 error
    if (min_purchase_amount != null && min_purchase_amount !== '' && (Number.isNaN(minPurchase) || minPurchase < 0)) {
      return res.status(400).json({ error: 'min_purchase_amount must be 0 or greater' }); // If the minimum purchase amount is not a number or is less than 0, return a 400 error
    }
    const active = is_active !== false; // Get the is active from the body
    const now = new Date(); // Get the current date
    // Insert the reward offering into the database
    const result = await db.pool.query(
      `INSERT INTO ${TABLE} (title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at`,
      [titleStr, rt, cost, valueNum, minPurchase, active, serviceTypeIdParsed, now] // Parameters for the query
    );
    const row = result.rows[0]; // Get the row from the result
    return res.status(201).json({ reward_offering: rowToOffering(row) }); // Return the reward offering as a JSON object
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message }); // If the status code is 400, return a 400 error
    console.error('[rewardOfferings] POST / error', err); // Log the error
    return next(err); // If there is an error, return the error
  }
});

// PATCH /api/reward-offerings/:id – update (admin / IT)
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // Try to update the reward offering
  try {
    const id = parseInt(req.params.id, 10); // Get the id from the request params
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    // Select the reward offering from the database
    const existing = await db.pool.query(
      `SELECT id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id
       FROM ${TABLE} WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' }); // If the reward offering is not found, return a 404 error
    const cur = existing.rows[0]; // Get the current reward offering from the result
    const { title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id } = req.body; // Get the title, reward type, point cost, value, minimum purchase amount, is active, and service type id from the body
    let mergedType = reward_type !== undefined ? String(reward_type).trim() : String(cur.reward_type).trim(); // Get the merged type from the body
    // If the merged type is not valid, return a 400 error
    if (reward_type !== undefined && !REWARD_TYPES.includes(mergedType)) {
      return res.status(400).json({ error: 'Invalid reward_type' }); // If the merged type is not valid, return a 400 error
    }
    // Get the merged value from the body
    let mergedValue =
      value !== undefined
        ? value === null || value === ''
          ? null
          : parseFloat(value)
        : cur.value != null
          ? Number(cur.value)
          : null;
    // If the merged value is not a number, return a 400 error
    if (value !== undefined && value !== null && value !== '' && Number.isNaN(mergedValue)) {
      return res.status(400).json({ error: 'value must be a number' }); // If the merged value is not a number, return a 400 error
    }
    // Get the merged service type id from the body
    let mergedServiceTypeId =
      service_type_id !== undefined
        ? service_type_id === null || service_type_id === ''
          ? null
          : parseInt(service_type_id, 10)
        : cur.service_type_id != null
          ? parseInt(cur.service_type_id, 10)
          : null;
    // If the merged service type id is not a number, return a 400 error
    if (service_type_id !== undefined && service_type_id !== null && service_type_id !== '' && Number.isNaN(mergedServiceTypeId)) {
      return res.status(400).json({ error: 'Invalid service_type_id' }); // If the merged service type id is not a number, return a 400 error
    }
    const offerErr = offeringValidationError(mergedType, mergedValue, mergedServiceTypeId); // Check if the offering is valid
    if (offerErr) return res.status(400).json({ error: offerErr }); // If the offering is not valid, return a 400 error
    await assertServiceTypeExists(mergedServiceTypeId); // Check if the service type exists
    const updates = []; // Initialize the updates array
    const values = []; // Initialize the values array
    let idx = 1; // Initialize the index to 1
    // If the title is not undefined, add it to the updates and values
    if (title !== undefined) {
      const titleStr = (title && String(title).trim()) || ''; // Get the title from the body
      if (!titleStr) return res.status(400).json({ error: 'title cannot be empty' }); // If the title is empty, return a 400 error
      updates.push(`title = $${idx++}`); // Add the title to the updates array
      values.push(titleStr); // Add the title to the values array
    }
    // If the reward type is not undefined, add it to the updates and values
    if (reward_type !== undefined) {
      updates.push(`reward_type = $${idx++}`); // Add the reward type to the updates array
      values.push(mergedType); // Add the reward type to the values array
    }
    // If the point cost is not undefined, add it to the updates and values
    if (point_cost !== undefined) {
      const cost = parseInt(point_cost, 10); // Get the point cost from the body
      if (Number.isNaN(cost) || cost <= 0) return res.status(400).json({ error: 'point_cost must be positive' }); // If the point cost is not a number or is less than 0, return a 400 error
      updates.push(`point_cost = $${idx++}`); // Add the point cost to the updates array
      values.push(cost); // Add the point cost to the values array
    }
    // If the value is not undefined, add it to the updates and values
    if (value !== undefined) {
      updates.push(`value = $${idx++}`); // Add the value to the updates array
      values.push(mergedValue); // Add the value to the values array
    }
    // If the minimum purchase amount is not undefined, add it to the updates and values
    if (min_purchase_amount !== undefined) {
      const minPurchase = min_purchase_amount === null || min_purchase_amount === '' ? null : parseFloat(min_purchase_amount); // Get the minimum purchase amount from the body
      // If the minimum purchase amount is not a number or is less than 0, return a 400 error
      if (min_purchase_amount !== null && min_purchase_amount !== '' && (Number.isNaN(minPurchase) || minPurchase < 0)) {
        return res.status(400).json({ error: 'min_purchase_amount must be >= 0' }); // If the minimum purchase amount is not a number or is less than 0, return a 400 error
      }
      updates.push(`min_purchase_amount = $${idx++}`); // Add the minimum purchase amount to the updates array
      values.push(minPurchase); // Add the minimum purchase amount to the values array
    }
    // If the is active is not undefined, add it to the updates and values
    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${idx++}`); // Add the is active to the updates array
      values.push(is_active); // Add the is active to the values array
    }
    // If the service type id is not undefined, add it to the updates and values
    if (service_type_id !== undefined) {
      updates.push(`service_type_id = $${idx++}`); // Add the service type id to the updates array
      values.push(mergedServiceTypeId); // Add the service type id to the values array
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' }); // If there are no fields to update, return a 400 error
    updates.push(`updated_at = $${idx++}`); // Add the updated at to the updates array
    values.push(new Date()); // Add the current date to the values array
    values.push(id); // Add the id to the values array
    // Execute the query to update the reward offering
    const result = await db.pool.query(
      `UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' }); // If the reward offering is not found, return a 404 error
    return res.json({ reward_offering: rowToOffering(result.rows[0]) }); // Return the reward offering as a JSON object
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message }); // If the status code is 400, return a 400 error
    return next(err);
  }
});

// DELETE /api/reward-offerings/:id – delete (admin / IT)
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // Try to delete the reward offering
  try {
    const id = parseInt(req.params.id, 10); // Get the id from the request params
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]); // Execute the query to delete the reward offering
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reward offering not found' }); // If the reward offering is not found, return a 404 error
    return res.status(204).send(); // Return a 204 status
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

module.exports = router;
