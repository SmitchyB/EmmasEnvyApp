const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module from ../lib/db
const { requireAuth, requireAdminOrIT } = require('../middleware/auth'); // Import the requireAuth and requireAdminOrIT middleware from ../middleware/auth
const router = express.Router(); // Create a new router
const TABLE = 'emmasenvy.newsletters'; // Define the table name
const PROMO_TABLE = 'emmasenvy.promo_codes'; // Define the promo code table name

/* This file is the backend route for the newsletters. It is used to create, update, and delete newsletters. */ 

// Convert the row to a newsletter
function rowToNewsletter(row) {
  if (!row) return null; // If the row is not found, return null
  // Return the newsletter object
  return {
    id: row.id, // Get the id from the row
    subject: row.subject, // Get the subject from the row
    content: row.content ?? '', // Get the content from the row and set it to an empty string if it is null
    promo_code_id: row.promo_code_id != null ? row.promo_code_id : null, // Get the promo code id from the row and set it to null if it is null
    promo_code: row.promo_code ?? null, // Get the promo code from the row and set it to null if it is null
    sent_at: row.sent_at, // Get the sent at from the row
    created_by: row.created_by != null ? row.created_by : null, // Get the created by from the row and set it to null if it is null
    created_at: row.created_at, // Get the created at from the row
  };
}

// GET /api/newsletters – list all (admin); optional ?status=draft|sent
router.get('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // Try to get the newsletters
  try {
    const status = req.query.status; // 'draft' | 'sent' or omit for all
    let where = ''; // Initialize the where clause
    const params = []; // Initialize the parameters
    // If the status is draft, add the where clause to the query
    if (status === 'draft') {
      where = ' WHERE n.sent_at IS NULL'; // Add the where clause to the query
    } 
    //Else if the status is sent, add the where clause to the query
    else if (status === 'sent') {
      where = ' WHERE n.sent_at IS NOT NULL'; // Add the where clause to the query
    }
    // Execute the query to get the newsletters
    const result = await db.pool.query(
      `SELECT n.id, n.subject, n.content, n.promo_code_id, n.sent_at, n.created_by, n.created_at,
              p.code AS promo_code
       FROM ${TABLE} n
       LEFT JOIN ${PROMO_TABLE} p ON p.id = n.promo_code_id
       ${where}
       ORDER BY n.sent_at DESC NULLS LAST, n.created_at DESC, n.id DESC`,
      params
    );
    const newsletters = result.rows.map(rowToNewsletter); // Map the rows to newsletters
    return res.json({ newsletters }); // Return the newsletters as a JSON object
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// POST /api/newsletters – create draft (admin)
router.post('/', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to get the user id from the request
  try {
    const userId = req.user?.id; // Get the user id from the request
    if (!userId) return res.status(401).json({ error: 'User not found' }); // If the user id is not found, return a 401 error
    const { subject, content, promo_code_id } = req.body; // Get the subject, content, and promo_code_id from the request body
    const subj = (subject && String(subject).trim()) || ''; // Get the subject from the request body and trim it
    if (!subj) return res.status(400).json({ error: 'Subject is required' }); // If the subject is not found, return a 400 error
    const body = content != null ? String(content) : ''; // Get the content from the request body and convert it to a string
    const promoId = promo_code_id == null || promo_code_id === '' ? null : parseInt(promo_code_id, 10); // Get the promo_code_id from the request body and parse it
    // If the promo_code_id is not null and is not an empty string and is not a number, return a 400 error
    if (promo_code_id != null && promo_code_id !== '' && Number.isNaN(promoId)) {
      return res.status(400).json({ error: 'Invalid promo_code_id' }); // If the promo_code_id is not a number, return a 400 error
    }
    // Execute the query to create the newsletter
    const result = await db.pool.query(
      `INSERT INTO ${TABLE} (subject, content, promo_code_id, sent_at, created_by)
       VALUES ($1, $2, $3, NULL, $4)
       RETURNING id, subject, content, promo_code_id, sent_at, created_by, created_at`,
      [subj, body, promoId, userId]
    );
    const row = result.rows[0]; // Get the first row from the result
    const promoResult = promoId ? await db.pool.query(`SELECT code FROM ${PROMO_TABLE} WHERE id = $1`, [promoId]) : { rows: [] }; // Get the promo code from the database
    // Return the newsletter as a JSON object
    const out = {
      id: row.id, // Get the id from the row
      subject: row.subject, // Get the subject from the row
      content: row.content, // Get the content from the row
      promo_code_id: row.promo_code_id, // Get the promo_code_id from the row
      promo_code: promoResult.rows[0]?.code ?? null, // Get the promo code from the result
      sent_at: row.sent_at, // Get the sent_at from the row
      created_by: row.created_by, // Get the created_by from the row
      created_at: row.created_at, // Get the created_at from the row
    };
    return res.status(201).json({ newsletter: out }); // Return the newsletter as a JSON object
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// PATCH /api/newsletters/:id – update draft only (admin)
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to get the id from the request parameters
  try {
    const id = parseInt(req.params.id, 10); // Parse the id from the request parameters
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    const { subject, content, promo_code_id } = req.body; // Get the subject, content, and promo_code_id from the request body
    const check = await db.pool.query(`SELECT id, sent_at FROM ${TABLE} WHERE id = $1`, [id]); // Execute the query to check if the newsletter exists
    if (check.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found' }); // If the newsletter is not found, return a 404 error
    if (check.rows[0].sent_at != null) return res.status(400).json({ error: 'Cannot edit a newsletter that has already been sent' }); // If the newsletter has already been sent, return a 400 error
    const updates = []; // Initialize the updates array
    const values = []; // Initialize the values array
    let idx = 1; // Initialize the index to 1
    // If the subject is not undefined, add it to the updates and values
    if (subject !== undefined) {
      const subj = String(subject).trim(); // Get the subject from the request body and trim it
      if (!subj) return res.status(400).json({ error: 'Subject cannot be empty' }); // If the subject is empty, return a 400 error
      updates.push(`subject = $${idx++}`); // Add the subject to the updates
      values.push(subj); // Add the subject to the values
    }
    // If the content is not undefined, add it to the updates and values
    if (content !== undefined) {
      updates.push(`content = $${idx++}`); // Add the content to the updates
      values.push(String(content)); // Add the content to the values
    }
    // If the promo_code_id is not undefined, add it to the updates and values
    if (promo_code_id !== undefined) {
      const promoId = promo_code_id === null || promo_code_id === '' ? null : parseInt(promo_code_id, 10); // Get the promo_code_id from the request body and parse it
      if (promo_code_id !== null && promo_code_id !== '' && Number.isNaN(promoId)) { // If the promo_code_id is not a number, return a 400 error
        return res.status(400).json({ error: 'Invalid promo_code_id' }); // If the promo_code_id is not a number, return a 400 error
      }
      updates.push(`promo_code_id = $${idx++}`); // Add the promo_code_id to the updates
      values.push(promoId); // Add the promo_code_id to the values
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' }); // If there are no fields to update, return a 400 error
    values.push(id); // Add the id to the values
    // Execute the query to update the newsletter
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET ${updates.join(', ')}
       WHERE id = $${idx} AND sent_at IS NULL
       RETURNING id, subject, content, promo_code_id, sent_at, created_by, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found or already sent' }); // If the newsletter is not found or already sent, return a 404 error
    const row = result.rows[0]; // Get the first row from the result
    const promoId = row.promo_code_id; // Get the promo_code_id from the row
    const promoResult = promoId ? await db.pool.query(`SELECT code FROM ${PROMO_TABLE} WHERE id = $1`, [promoId]) : { rows: [] }; // Get the promo code from the database
    // Return the newsletter as a JSON object
    const out = {
      id: row.id, // Get the id from the row
      subject: row.subject, // Get the subject from the row
      content: row.content, // Get the content from the row
      promo_code_id: row.promo_code_id, // Get the promo_code_id from the row
      promo_code: promoResult.rows[0]?.code ?? null, // Get the promo code from the result
      sent_at: row.sent_at, // Get the sent_at from the row
      created_by: row.created_by, // Get the created_by from the row
      created_at: row.created_at, // Get the created_at from the row
    };
    return res.json({ newsletter: out }); // Return the newsletter as a JSON object
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// POST /api/newsletters/:id/send – mark as sent (admin)
router.post('/:id/send', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to get the id from the request parameters
  try {
    const id = parseInt(req.params.id, 10); // Parse the id from the request parameters
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    // Execute the query to mark the newsletter as sent
    const result = await db.pool.query(
      `UPDATE ${TABLE}
       SET sent_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND sent_at IS NULL
       RETURNING id, subject, content, promo_code_id, sent_at, created_by, created_at`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found or already sent' }); // If the newsletter is not found or already sent, return a 404 error
    const row = result.rows[0]; // Get the first row from the result
    const promoId = row.promo_code_id; // Get the promo_code_id from the row
    const promoResult = promoId ? await db.pool.query(`SELECT code FROM ${PROMO_TABLE} WHERE id = $1`, [promoId]) : { rows: [] }; // Get the promo code from the database
    // Return the newsletter as a JSON object
    const out = {
      id: row.id, // Get the id from the row
      subject: row.subject, // Get the subject from the row
      content: row.content, // Get the content from the row
      promo_code_id: row.promo_code_id, // Get the promo_code_id from the row
      promo_code: promoResult.rows[0]?.code ?? null, // Get the promo code from the result
      sent_at: row.sent_at, // Get the sent_at from the row
      created_by: row.created_by, // Get the created_by from the row
      created_at: row.created_at, // Get the created_at from the row
    };
    return res.json({ newsletter: out }); // Return the newsletter as a JSON object
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

// DELETE /api/newsletters/:id – drafts only (admin)
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  //Try to get the id from the request parameters
  try {
    const id = parseInt(req.params.id, 10); // Parse the id from the request parameters
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // If the id is not a number, return a 400 error
    // Execute the query to delete the newsletter
    const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 AND sent_at IS NULL RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found or already sent; cannot delete' }); // If the newsletter is not found or already sent, return a 404 error
    return res.status(204).send(); // Return a 204 status
  } catch (err) {
    return next(err); // If there is an error, return the error
  }
});

module.exports = router;
