const path = require('path'); // Import the path module
const fs = require('fs'); // Import the fs module 
const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module
const { requireAuth, requireAdmin, requireAdminOrIT } = require('../middleware/auth'); // Import the requireAuth, requireAdmin, and requireAdminOrIT middleware
const { portfolioPhotoUpload, portfolioMePhotoUpload } = require('../lib/upload'); // Import the portfolioPhotoUpload and portfolioMePhotoUpload functions

const PORTFOLIOS_TABLE = 'emmasenvy.portfolios'; // Define the portfolios table
const PORTFOLIO_PHOTOS_TABLE = 'emmasenvy.portfolio_photos'; // Define the portfolio photos table
const USERS_TABLE = 'emmasenvy.users'; // Define the users table

// Define the portfolioRowToJson function
function portfolioRowToJson(row) { // row is the row from the portfolios table
  if (!row) return null; // If the row is not found, return null
  // If the first name or last name is not found, return null
  const name =
    row.first_name != null || row.last_name != null
      ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null
      : null;
  // Return the portfolio row as a JSON object
  return {
    id: row.id, // Set the id of the portfolio
    employee_id: row.employee_id, // Set the employee id of the portfolio
    description: row.description ?? null, // Set the description of the portfolio
    visible: row.visible === true, // Set the visible of the portfolio
    name: name || null, // Set the name of the portfolio
    portrait: row.profile_picture ?? null, // Set the portrait of the portfolio
    created_at: row.created_at, // Set the created at of the portfolio
    updated_at: row.updated_at, // Set the updated at of the portfolio
  };
}
// Define the photoRowToJson function
function photoRowToJson(row) {
  if (!row) return null; // If the row is not found, return null
  return {
    id: row.id, // Set the id of the photo
    portfolio_id: row.portfolio_id, // Set the portfolio id of the photo
    url: row.url ?? null, // Set the url of the photo
    caption: row.caption ?? null, // Set the caption of the photo
    sort_order: row.sort_order != null ? Number(row.sort_order) : 0, // Set the sort order of the photo
    created_at: row.created_at, // Set the created at of the photo
    updated_at: row.updated_at, // Set the updated at of the photo
  };
}

const router = express.Router(); // Define the router

// GET /api/portfolios – list visible portfolios with name and portrait from users
router.get('/', async (req, res, next) => {
  // Try to get the portfolios from the database
  try {
    // Query the portfolios table
    const result = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.visible = true
       ORDER BY p.id`
    );
    const portfolios = result.rows.map(portfolioRowToJson); // Map the portfolios to a JSON object
    res.json({ portfolios }); // Return the portfolios as a JSON object
  } catch (err) {
    console.error('[Portfolios] GET / error', err); // Log the error
    return next(err); // Return the error
  }
});

// GET /api/portfolios/primary – fixed portfolio id 1 when visible (must be before /:id)
router.get('/primary', async (req, res, next) => {
  console.log('[Portfolios] GET /primary requested'); // Log the request
  // Try to get the primary portfolio from the database
  try {
    const portfolioResult = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.id = 1 AND p.visible = true`
    );
    console.log('[Portfolios] GET /primary portfolio rows:', portfolioResult.rowCount); // Log the number of rows in the portfolio result
    const row = portfolioResult.rows[0]; // Set the row to the first row in the portfolio result
    // If the row is not found, return a 404 error
    if (!row) {
      console.log('[Portfolios] GET /primary id=1 not visible or missing -> 404'); // Log the error
      return res.status(404).json({ error: 'No visible portfolio found' }); // Return a 404 error
    }
    const portfolio = portfolioRowToJson(row); // Set the portfolio to the portfolio row as a JSON object
    // Query the portfolio photos table
    const photosResult = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE}
       WHERE portfolio_id = $1
       ORDER BY COALESCE(sort_order, 0), id`,
      [portfolio.id]
    );
    console.log('[Portfolios] GET /primary portfolio id=%s photos=%s', portfolio.id, photosResult.rowCount); // Log the portfolio id and the number of photos in the portfolio
    portfolio.photos = photosResult.rows.map(photoRowToJson); // Map the photos to a JSON object
    res.json({ portfolio }); // Return the portfolio as a JSON object
  } catch (err) {
    console.error('[Portfolios] GET /primary error', err); // Log the error
    return next(err); // Return the error
  }
});

// GET /api/portfolios/me – current user's portfolio (Admin/IT), with photos
router.get('/me', requireAuth, requireAdminOrIT, async (req, res, next) => {
  const userId = req.user.id; // Set the user id to the user id from the request
  // Try to get the portfolio from the database
  try {
    // Query the portfolios table
    const portfolioResult = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.employee_id = $1`,
      [userId]
    );
    const row = portfolioResult.rows[0]; // Set the row to the first row in the portfolio result
    // If the row is not found, return a 404 error
    if (!row) {
      return res.status(404).json({ error: 'Portfolio not found' }); // Return a 404 error
    }
    const portfolio = portfolioRowToJson(row); // Set the portfolio to the portfolio row as a JSON object
    // Query the portfolio photos table
    const photosResult = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE}
       WHERE portfolio_id = $1
       ORDER BY COALESCE(sort_order, 0), id`,
      [portfolio.id]
    );
    portfolio.photos = photosResult.rows.map(photoRowToJson); // Map the photos to a JSON object
    res.json({ portfolio }); // Return the portfolio as a JSON object
  } catch (err) {
    console.error('[Portfolios] GET /me error', err); // Log the error
    return next(err); // Return the error
  }
});

// POST /api/portfolios/me – create or update current user's portfolio (Admin/IT)
router.post('/me', requireAuth, requireAdminOrIT, async (req, res, next) => {
  const userId = req.user.id; // Set the user id to the user id from the request
  const { description, visible, name } = req.body; // Set the description, visible, and name to the description, visible, and name from the request
  const now = new Date(); // Set the now to the current date and time
  // Try to create or update the portfolio
  try {
    // If the name is not undefined, update the user's first and last name
    if (name !== undefined) {
      const raw = name == null ? '' : String(name).trim(); // Set the raw to the name from the request
      let first_name = null; // Set the first name to null
      let last_name = null; // Set the last name to null
      // If the raw is not null, split the raw by the spaces
      if (raw) {
        const parts = raw.split(/\s+/); // Split the raw by the spaces
        first_name = parts[0] || null; // Set the first name to the first part of the parts
        last_name = parts.length > 1 ? parts.slice(1).join(' ') : null; // Set the last name to the last part of the parts
      }
      // Update the user's first and last name
      await db.pool.query( // Update the user's first and last name
        `UPDATE ${USERS_TABLE} SET first_name = $1, last_name = $2, updated_at = $3 WHERE id = $4`, // Update the user's first and last name
        [first_name, last_name, now, userId] // Add the first name, last name, now, and user id to the values
      );
    }
    // Query the portfolios table to check if the portfolio exists
    const existing = await db.pool.query(
      `SELECT id FROM ${PORTFOLIOS_TABLE} WHERE employee_id = $1`,
      [userId]
    );
    // If the portfolio does not exist, create it
    if (existing.rows.length === 0) {
      // Insert the portfolio into the database
      await db.pool.query(
        `INSERT INTO ${PORTFOLIOS_TABLE} (employee_id, description, visible, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [userId, description != null ? String(description).trim() || null : null, visible === true, now]
      );
    } 
    //else update the portfolio
    else {
      const updates = []; // Set the updates to an empty array
      const values = []; // Set the values to an empty array
      let idx = 1; // Set the index to 1
      // If the description is not undefined, add it to the updates
      if (description !== undefined) {
        updates.push(`description = $${idx++}`); // Add the description to the updates
        values.push(String(description).trim() || null); // Add the description to the values
      }
      // If the visible is not undefined, add it to the updates and values
      if (visible !== undefined) {
        updates.push(`visible = $${idx++}`); // Add the visible to the updates
        values.push(!!visible); // Add the visible to the values
      }
      // If the updates are not empty, update the portfolio
      if (updates.length > 0) {
        values.push(now, userId); // Add the now and user id to the values
        await db.pool.query(
          `UPDATE ${PORTFOLIOS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx++} WHERE employee_id = $${idx}`, // Update the portfolio
          values // Add the values to the query
        );
      }
    }
    // Query the portfolios table to get the portfolio
    const portfolioResult = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.employee_id = $1`,
      [userId]
    );
    const row = portfolioResult.rows[0]; // Set the row to the first row in the portfolio result
    if (!row) return res.status(500).json({ error: 'Portfolio not found after save' }); // Return a 500 error if the portfolio is not found
    const portfolio = portfolioRowToJson(row); // Set the portfolio to the portfolio row as a JSON object
    // Query the portfolio photos table to get the photos
    const photosResult = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE}
       WHERE portfolio_id = $1
       ORDER BY COALESCE(sort_order, 0), id`,
      [portfolio.id]
    );  
    portfolio.photos = photosResult.rows.map(photoRowToJson); // Map the photos to a JSON object
    res.json({ portfolio }); // Return the portfolio as a JSON object
  } catch (err) {
    console.error('[Portfolios] POST /me error', err); // Log the error
    return next(err); // Return the error
  }
});

// POST /api/portfolios/me/photos – upload photo to current user's portfolio (Admin/IT)
router.post(
  '/me/photos',
  requireAuth,
  requireAdminOrIT,
  portfolioMePhotoUpload.single('photo'), // Upload the photo to the portfolio
  async (req, res, next) => {
    const userId = req.user.id; // Set the user id to the user id from the request
    // If the file is not found, return a 400 error
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' }); // Return a 400 error if the file is not found
    }
    // Try to get the portfolio from the database
    try {
      // Query the portfolios table to get the portfolio
      const portfolioResult = await db.pool.query(
        `SELECT id FROM ${PORTFOLIOS_TABLE} WHERE employee_id = $1`,
        [userId]
      );
      const portfolioRow = portfolioResult.rows[0]; // Set the row to the first row in the portfolio result
      // If the row is not found, return a 404 error
      if (!portfolioRow) {
        fs.unlinkSync(req.file.path); // Delete the file
        return res.status(404).json({ error: 'Portfolio not found. Create your portfolio first.' }); // Return a 404 error if the portfolio is not found
      }
      const portfolioId = portfolioRow.id; // Set the portfolio id to the portfolio id from the row
      // Join the path to the portfolio and the file name
      const relativePath = path.join('portfolio', req.file.filename).split(path.sep).join('/');
      const caption = req.body.caption != null ? String(req.body.caption).trim() : null; // Set the caption to the caption from the request
      // Query the portfolio photos table to get the max sort order
      const maxResult = await db.pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1`,
        [portfolioId]
      );
      const sortOrder = maxResult.rows[0]?.next_order ?? 0; // Set the sort order to the next order from the result
      // Insert the photo into the database
      const insertResult = await db.pool.query(
        `INSERT INTO ${PORTFOLIO_PHOTOS_TABLE} (portfolio_id, url, caption, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id, portfolio_id, url, caption, sort_order, created_at, updated_at`,
        [portfolioId, relativePath, caption || null, sortOrder, new Date()]
      );
      const photo = photoRowToJson(insertResult.rows[0]); // Set the photo to the photo row as a JSON object
      // Return the photo as a JSON object
      res.status(201).json({ photo }); // Return the photo as a JSON object
    } catch (err) {
      try {
        fs.unlinkSync(req.file.path); // Delete the file
      } catch (_) {}
      console.error('[Portfolios] POST /me/photos error', err); // Log the error
      return next(err); // Return the error
    }
  }
);

// PATCH /api/portfolios/me/photos/:photoId – update caption/sort_order (Admin/IT)
router.patch('/me/photos/:photoId', requireAuth, requireAdminOrIT, async (req, res, next) => {
  const userId = req.user.id; // Set the user id to the user id from the request 
  const photoId = parseInt(req.params.photoId, 10); // Set the photo id to the photo id from the request
  // If the photo id is not a number, return a 400 error
  if (Number.isNaN(photoId)) {
    return res.status(400).json({ error: 'Invalid photo id' }); // Return a 400 error if the photo id is not a number
  }
  const { caption, sort_order } = req.body; // Set the caption and sort order to the caption and sort order from the request
  const updates = []; // Set the updates to an empty array
  const values = []; // Set the values to an empty array
  let idx = 1; // Set the index to 1
  // If the caption is not undefined, add it to the updates and values
  if (caption !== undefined) {
    updates.push(`caption = $${idx++}`); // Add the caption to the updates
    values.push(String(caption).trim() || null); // Add the caption to the values
  }
  // If the sort order is not undefined, add it to the updates and values
  if (sort_order !== undefined) {
    const n = parseInt(sort_order, 10); // Set the n to the sort order from the request
    if (!Number.isNaN(n)) {
      updates.push(`sort_order = $${idx++}`); // Add the sort order to the updates
      values.push(n); // Add the n to the values
    }
  }
  // If the updates are empty, return a 404 error
  if (updates.length === 0) {
    // Query the portfolio photos table to get the photo
    const result = await db.pool.query(
      `SELECT ph.id, ph.portfolio_id, ph.url, ph.caption, ph.sort_order, ph.created_at, ph.updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE} ph
       JOIN ${PORTFOLIOS_TABLE} p ON p.id = ph.portfolio_id AND p.employee_id = $1
       WHERE ph.id = $2`,
      [userId, photoId]
    );
    const row = result.rows[0]; // Set the row to the first row in the result
    if (!row) return res.status(404).json({ error: 'Photo not found' }); // Return a 404 error if the photo is not found
    return res.json({ photo: photoRowToJson(row) }); // Return the photo as a JSON object
  }
  values.push(new Date(), userId, photoId); // Add the now, user id, and photo id to the values
  // Try to update the photo
  try {
    // Update the photo in the database
    await db.pool.query(
      `UPDATE ${PORTFOLIO_PHOTOS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx++}
       FROM ${PORTFOLIOS_TABLE} p
       WHERE ${PORTFOLIO_PHOTOS_TABLE}.portfolio_id = p.id AND p.employee_id = $${idx++} AND ${PORTFOLIO_PHOTOS_TABLE}.id = $${idx}`,
      values
    );
    // Query the portfolio photos table to get the photo
    const result = await db.pool.query(
      `SELECT ph.id, ph.portfolio_id, ph.url, ph.caption, ph.sort_order, ph.created_at, ph.updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE} ph
       JOIN ${PORTFOLIOS_TABLE} p ON p.id = ph.portfolio_id AND p.employee_id = $1
       WHERE ph.id = $2`,
      [userId, photoId]
    );
    const row = result.rows[0]; // Set the row to the first row in the result
    if (!row) return res.status(404).json({ error: 'Photo not found' }); // Return a 404 error if the photo is not found
    res.json({ photo: photoRowToJson(row) }); // Return the photo as a JSON object
  } catch (err) {
    console.error('[Portfolios] PATCH /me/photos/:photoId error', err); // Log the error
    return next(err); // Return the error
  }
});

// DELETE /api/portfolios/me/photos/:photoId – delete photo (Admin/IT)
router.delete('/me/photos/:photoId', requireAuth, requireAdminOrIT, async (req, res, next) => {
  const userId = req.user.id; // Set the user id to the user id from the request
  const photoId = parseInt(req.params.photoId, 10); // Set the photo id to the photo id from the request
  // If the photo id is not a number, return a 400 error
  if (Number.isNaN(photoId)) {
    return res.status(400).json({ error: 'Invalid photo id' }); // Return a 400 error if the photo id is not a number
  }
  // Try to delete the photo
  try {
    // Query the portfolio photos table to get the photo
    const result = await db.pool.query(
      `SELECT ph.id, ph.url FROM ${PORTFOLIO_PHOTOS_TABLE} ph
       JOIN ${PORTFOLIOS_TABLE} p ON p.id = ph.portfolio_id AND p.employee_id = $1
       WHERE ph.id = $2`,
      [userId, photoId]
    ); 
    const row = result.rows[0]; // Set the row to the first row in the result
    // If the row is not found, return a 404 error
    if (!row) {
      return res.status(404).json({ error: 'Photo not found' }); // Return a 404 error if the photo is not found
    }
    // Delete the photo from the database
    await db.pool.query(
      `DELETE FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE id = $1`,
      [photoId]
    );
    // If the url is not null, delete the file
    if (row.url && (row.url.startsWith('portfolio/') || row.url.includes('portfolio/'))) {
      const filePath = path.join(__dirname, '..', 'uploads', row.url); // Join the path to the uploads and the url
      // Try to delete the file
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Delete the file
      } catch (_) {}
    }
    res.status(204).send(); // Return a 204 status
  } catch (err) {
    console.error('[Portfolios] DELETE /me/photos/:photoId error', err); // Log the error
    return next(err); // Return the error
  }
});

// GET /api/portfolios/:id – single portfolio with photos
router.get('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10); // Set the id to the id from the request
  // If the id is not a number, return a 400 error
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid portfolio id' }); // Return a 400 error if the id is not a number
  }
  // Try to get the portfolio from the database
  try {
    // Query the portfolios table to get the portfolio
    const portfolioResult = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.id = $1`,
      [id]
    );
    const row = portfolioResult.rows[0]; // Set the row to the first row in the result
    // If the row is not found, return a 404 error
    if (!row) {
      return res.status(404).json({ error: 'Portfolio not found' }); // Return a 404 error if the portfolio is not found
    }
    const portfolio = portfolioRowToJson(row); // Set the portfolio to the portfolio row as a JSON object
    // Query the portfolio photos table to get the photos
    const photosResult = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE}
       WHERE portfolio_id = $1
       ORDER BY COALESCE(sort_order, 0), id`,
      [id]
    );
    portfolio.photos = photosResult.rows.map(photoRowToJson); // Map the photos to a JSON object
    res.json({ portfolio }); // Return the portfolio as a JSON object
  } catch (err) {
    console.error('[Portfolios] GET /:id error', err); // Log the error
    return next(err); // Return the error
  }
});

// PATCH /api/portfolios/:id – auth + admin, update description, visible
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10); // Set the id to the id from the request
  // If the id is not a number, return a 400 error
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid portfolio id' }); // Return a 400 error if the id is not a number 
  }
  const { description, visible } = req.body; // Set the description and visible to the description and visible from the request
  // Try to update the portfolio
  try {
    const updates = []; // Set the updates to an empty array
    const values = []; // Set the values to an empty array
    let idx = 1; // Set the index to 1
    // If the description is not undefined, add it to the updates and values
    if (description !== undefined) {
      updates.push(`description = $${idx++}`); // Add the description to the updates
      values.push(description); // Add the description to the values
    }
    // If the visible is not undefined, add it to the updates and values
    if (visible !== undefined) {
      updates.push(`visible = $${idx++}`); // Add the visible to the updates
      values.push(!!visible); // Add the visible to the values
    }
    // If the updates are empty, return a 404 error
    if (updates.length === 0) {
      // Query the portfolios table to get the portfolio
      const result = await db.pool.query(
        `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
                u.first_name, u.last_name, u.profile_picture
         FROM ${PORTFOLIOS_TABLE} p
         LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
         WHERE p.id = $1`,
        [id]
      );
      const row = result.rows[0]; // Set the row to the first row in the result
      if (!row) return res.status(404).json({ error: 'Portfolio not found' }); // Return a 404 error if the portfolio is not found
      return res.json({ portfolio: portfolioRowToJson(row) }); // Return the portfolio as a JSON object
    }
    values.push(new Date(), id); // Add the now and id to the values
    // Update the portfolio in the database
    await db.pool.query(
      `UPDATE ${PORTFOLIOS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx++} WHERE id = $${idx}`,
      values
    );
    // Query the portfolios table to get the portfolio
    const result = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.id = $1`,
      [id]
    );
    const row = result.rows[0]; // Set the row to the first row in the result
    if (!row) return res.status(404).json({ error: 'Portfolio not found' }); // Return a 404 error if the portfolio is not found
    res.json({ portfolio: portfolioRowToJson(row) }); // Return the portfolio as a JSON object
  } catch (err) {
    console.error('[Portfolios] PATCH /:id error', err); // Log the error 
    return next(err); // Return the error
  }
});

// POST /api/portfolios/:id/photo – auth + admin, upload photo
router.post(
  '/:id/photo',
  requireAuth,
  requireAdmin,
  portfolioPhotoUpload.single('photo'),
  async (req, res, next) => {
    const portfolioId = parseInt(req.params.id, 10); // Set the portfolio id to the portfolio id from the request
    // If the portfolio id is not a number, return a 400 error
    if (Number.isNaN(portfolioId)) {
      return res.status(400).json({ error: 'Invalid portfolio id' }); // Return a 400 error if the portfolio id is not a number
    }
    // If the file is not found, return a 400 error
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' }); // Return a 400 error if the file is not found
    }
    const relativePath = path.join('portfolio', req.file.filename).split(path.sep).join('/'); // Join the path to the portfolio and the file name
    const caption = req.body.caption != null ? String(req.body.caption).trim() : null; // Set the caption to the caption from the request
    let sortOrder = 0; // Set the sort order to 0
    // If the sort order is not undefined, set the sort order to the sort order from the request
    if (req.body.sort_order !== undefined) {
      const n = parseInt(req.body.sort_order, 10); // Set the n to the sort order from the request
      if (!Number.isNaN(n)) sortOrder = n; // Set the sort order to the n if the n is not a number
    } 
    //else set the sort order to the next order
    else {
      const maxResult = await db.pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1`, // Query the portfolio photos table to get the next order
        [portfolioId] // Set the portfolio id to the portfolio id from the request
      );
      sortOrder = maxResult.rows[0]?.next_order ?? 0; // Set the sort order to the next order from the result
    }
    // Try to insert the photo into the database
    try {
      // Insert the photo into the database
      const insertResult = await db.pool.query(
        `INSERT INTO ${PORTFOLIO_PHOTOS_TABLE} (portfolio_id, url, caption, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id, portfolio_id, url, caption, sort_order, created_at, updated_at`,
        [portfolioId, relativePath, caption || null, sortOrder, new Date()]
      );
      const photo = photoRowToJson(insertResult.rows[0]); // Set the photo to the photo row as a JSON object
      res.status(201).json({ photo }); // Return the photo as a JSON object
    } catch (err) {
      // Try to delete the file
      try {
        fs.unlinkSync(req.file.path); // Delete the file
      } catch (_) {}
      console.error('[Portfolios] POST /:id/photo error', err); // Log the error
      return next(err); // Return the error
    }
  }
);

// PATCH /api/portfolios/:id/photos/:photoId – auth + admin, update caption/sort_order
router.patch('/:id/photos/:photoId', requireAuth, requireAdmin, async (req, res, next) => {
  const portfolioId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10); // Set the photo id to the photo id from the request
  // If the portfolio id or photo id is not a number, return a 400 error
  if (Number.isNaN(portfolioId) || Number.isNaN(photoId)) {
    return res.status(400).json({ error: 'Invalid id' }); // Return a 400 error if the portfolio id or photo id is not a number
  }
  const { caption, sort_order } = req.body; // Set the caption and sort order to the caption and sort order from the request
  const updates = []; // Set the updates to an empty array
  const values = []; // Set the values to an empty array
  let idx = 1; // Set the index to 1
  // If the caption is not undefined, add it to the updates and values
  if (caption !== undefined) {
    updates.push(`caption = $${idx++}`); // Add the caption to the updates
    values.push(String(caption).trim() || null); // Add the caption to the values
  }
  // If the sort order is not undefined, add it to the updates and values
  if (sort_order !== undefined) {
    const n = parseInt(sort_order, 10); // Set the n to the sort order from the request
    if (!Number.isNaN(n)) {
      updates.push(`sort_order = $${idx++}`); // Add the sort order to the updates
      values.push(n); // Add the n to the values
    }
  }
  // If the updates are empty, return a 404 error
  if (updates.length === 0) {
    // Query the portfolio photos table to get the photo
    const result = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    const row = result.rows[0]; // Set the row to the first row in the result
    if (!row) return res.status(404).json({ error: 'Photo not found' }); // Return a 404 error if the photo is not found
    return res.json({ photo: photoRowToJson(row) }); // Return the photo as a JSON object
  }
  values.push(new Date(), portfolioId, photoId); // Add the now, portfolio id, and photo id to the values
  // Try to update the photo
  try {
    // Update the photo in the database
    await db.pool.query(
      `UPDATE ${PORTFOLIO_PHOTOS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx++}
       WHERE portfolio_id = $${idx++} AND id = $${idx}`,
      values
    );
    //Query the portfolio photos table to get the photo
    const result = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    const row = result.rows[0]; // Set the row to the first row in the result
    if (!row) return res.status(404).json({ error: 'Photo not found' }); // Return a 404 error if the photo is not found
    res.json({ photo: photoRowToJson(row) }); // Return the photo as a JSON object
  } catch (err) {
    console.error('[Portfolios] PATCH /:id/photos/:photoId error', err); // Log the error
    return next(err);
  }
});

// DELETE /api/portfolios/:id/photos/:photoId – auth + admin
router.delete('/:id/photos/:photoId', requireAuth, requireAdmin, async (req, res, next) => {
  const portfolioId = parseInt(req.params.id, 10); // Set the portfolio id to the portfolio id from the request
  const photoId = parseInt(req.params.photoId, 10); // Set the photo id to the photo id from the request
  // If the portfolio id or photo id is not a number, return a 400 error
  if (Number.isNaN(portfolioId) || Number.isNaN(photoId)) {
    return res.status(400).json({ error: 'Invalid id' }); // Return a 400 error if the portfolio id or photo id is not a number
  }
  // Try to delete the photo
  try {
    // Query the portfolio photos table to get the photo
    const result = await db.pool.query(
      `SELECT id, url FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    const row = result.rows[0]; // Set the row to the first row in the result
    // If the row is not found, return a 404 error
    if (!row) {
      return res.status(404).json({ error: 'Photo not found' }); // Return a 404 error if the photo is not found
    }
    // Delete the photo from the database
    await db.pool.query(
      `DELETE FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    // if the url is not null and starts with 'portfolio/', delete the file
    if (row.url && row.url.startsWith('portfolio/')) {
      const filePath = path.join(__dirname, '..', 'uploads', row.url); // Join the path to the uploads and the url
      // Try to delete the file
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Delete the file
      } catch (_) {}
    }
    res.status(204).send(); // Return a 204 status
  } catch (err) {
    console.error('[Portfolios] DELETE /:id/photos/:photoId error', err); // Log the error
    return next(err); // Return the error
  }
});

module.exports = router; // Export the router
