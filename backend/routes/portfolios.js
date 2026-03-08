const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { portfolioPhotoUpload } = require('../lib/upload');

const PORTFOLIOS_TABLE = 'emmasenvy.portfolios';
const PORTFOLIO_PHOTOS_TABLE = 'emmasenvy.portfolio_photos';
const USERS_TABLE = 'emmasenvy.users';

function portfolioRowToJson(row) {
  if (!row) return null;
  const name =
    row.first_name != null || row.last_name != null
      ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null
      : null;
  return {
    id: row.id,
    employee_id: row.employee_id,
    description: row.description ?? null,
    visible: row.visible === true,
    name: name || null,
    portrait: row.profile_picture ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function photoRowToJson(row) {
  if (!row) return null;
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    url: row.url ?? null,
    caption: row.caption ?? null,
    sort_order: row.sort_order != null ? Number(row.sort_order) : 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const router = express.Router();

// GET /api/portfolios – list visible portfolios with name and portrait from users
router.get('/', async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.visible = true
       ORDER BY p.id`
    );
    const portfolios = result.rows.map(portfolioRowToJson);
    res.json({ portfolios });
  } catch (err) {
    console.error('[Portfolios] GET / error', err);
    return next(err);
  }
});

// GET /api/portfolios/primary – first visible portfolio with photos (must be before /:id)
router.get('/primary', async (req, res, next) => {
  console.log('[Portfolios] GET /primary requested');
  try {
    const portfolioResult = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.visible = true
       ORDER BY p.id
       LIMIT 1`
    );
    console.log('[Portfolios] GET /primary portfolio rows:', portfolioResult.rowCount);
    const row = portfolioResult.rows[0];
    if (!row) {
      console.log('[Portfolios] GET /primary no visible portfolio -> 404');
      return res.status(404).json({ error: 'No visible portfolio found' });
    }
    const portfolio = portfolioRowToJson(row);
    const photosResult = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE}
       WHERE portfolio_id = $1
       ORDER BY COALESCE(sort_order, 0), id`,
      [portfolio.id]
    );
    console.log('[Portfolios] GET /primary portfolio id=%s photos=%s', portfolio.id, photosResult.rowCount);
    portfolio.photos = photosResult.rows.map(photoRowToJson);
    res.json({ portfolio });
  } catch (err) {
    console.error('[Portfolios] GET /primary error', err);
    return next(err);
  }
});

// GET /api/portfolios/:id – single portfolio with photos
router.get('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid portfolio id' });
  }
  try {
    const portfolioResult = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.id = $1`,
      [id]
    );
    const row = portfolioResult.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    const portfolio = portfolioRowToJson(row);
    const photosResult = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE}
       WHERE portfolio_id = $1
       ORDER BY COALESCE(sort_order, 0), id`,
      [id]
    );
    portfolio.photos = photosResult.rows.map(photoRowToJson);
    res.json({ portfolio });
  } catch (err) {
    console.error('[Portfolios] GET /:id error', err);
    return next(err);
  }
});

// PATCH /api/portfolios/:id – auth + admin, update description, visible
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid portfolio id' });
  }
  const { description, visible } = req.body;
  try {
    const updates = [];
    const values = [];
    let idx = 1;
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description);
    }
    if (visible !== undefined) {
      updates.push(`visible = $${idx++}`);
      values.push(!!visible);
    }
    if (updates.length === 0) {
      const result = await db.pool.query(
        `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
                u.first_name, u.last_name, u.profile_picture
         FROM ${PORTFOLIOS_TABLE} p
         LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
         WHERE p.id = $1`,
        [id]
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: 'Portfolio not found' });
      return res.json({ portfolio: portfolioRowToJson(row) });
    }
    values.push(new Date(), id);
    await db.pool.query(
      `UPDATE ${PORTFOLIOS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx++} WHERE id = $${idx}`,
      values
    );
    const result = await db.pool.query(
      `SELECT p.id, p.employee_id, p.description, p.visible, p.created_at, p.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM ${PORTFOLIOS_TABLE} p
       LEFT JOIN ${USERS_TABLE} u ON u.id = p.employee_id
       WHERE p.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Portfolio not found' });
    res.json({ portfolio: portfolioRowToJson(row) });
  } catch (err) {
    console.error('[Portfolios] PATCH /:id error', err);
    return next(err);
  }
});

// POST /api/portfolios/:id/photo – auth + admin, upload photo
router.post(
  '/:id/photo',
  requireAuth,
  requireAdmin,
  portfolioPhotoUpload.single('photo'),
  async (req, res, next) => {
    const portfolioId = parseInt(req.params.id, 10);
    if (Number.isNaN(portfolioId)) {
      return res.status(400).json({ error: 'Invalid portfolio id' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' });
    }
    const relativePath = path.join('portfolio', req.file.filename).split(path.sep).join('/');
    const caption = req.body.caption != null ? String(req.body.caption).trim() : null;
    let sortOrder = 0;
    if (req.body.sort_order !== undefined) {
      const n = parseInt(req.body.sort_order, 10);
      if (!Number.isNaN(n)) sortOrder = n;
    } else {
      const maxResult = await db.pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1`,
        [portfolioId]
      );
      sortOrder = maxResult.rows[0]?.next_order ?? 0;
    }
    try {
      const insertResult = await db.pool.query(
        `INSERT INTO ${PORTFOLIO_PHOTOS_TABLE} (portfolio_id, url, caption, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id, portfolio_id, url, caption, sort_order, created_at, updated_at`,
        [portfolioId, relativePath, caption || null, sortOrder, new Date()]
      );
      const photo = photoRowToJson(insertResult.rows[0]);
      res.status(201).json({ photo });
    } catch (err) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
      console.error('[Portfolios] POST /:id/photo error', err);
      return next(err);
    }
  }
);

// PATCH /api/portfolios/:id/photos/:photoId – auth + admin, update caption/sort_order
router.patch('/:id/photos/:photoId', requireAuth, requireAdmin, async (req, res, next) => {
  const portfolioId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (Number.isNaN(portfolioId) || Number.isNaN(photoId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const { caption, sort_order } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;
  if (caption !== undefined) {
    updates.push(`caption = $${idx++}`);
    values.push(String(caption).trim() || null);
  }
  if (sort_order !== undefined) {
    const n = parseInt(sort_order, 10);
    if (!Number.isNaN(n)) {
      updates.push(`sort_order = $${idx++}`);
      values.push(n);
    }
  }
  if (updates.length === 0) {
    const result = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Photo not found' });
    return res.json({ photo: photoRowToJson(row) });
  }
  values.push(new Date(), portfolioId, photoId);
  try {
    await db.pool.query(
      `UPDATE ${PORTFOLIO_PHOTOS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx++}
       WHERE portfolio_id = $${idx++} AND id = $${idx}`,
      values
    );
    const result = await db.pool.query(
      `SELECT id, portfolio_id, url, caption, sort_order, created_at, updated_at
       FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Photo not found' });
    res.json({ photo: photoRowToJson(row) });
  } catch (err) {
    console.error('[Portfolios] PATCH /:id/photos/:photoId error', err);
    return next(err);
  }
});

// DELETE /api/portfolios/:id/photos/:photoId – auth + admin
router.delete('/:id/photos/:photoId', requireAuth, requireAdmin, async (req, res, next) => {
  const portfolioId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (Number.isNaN(portfolioId) || Number.isNaN(photoId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const result = await db.pool.query(
      `SELECT id, url FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    await db.pool.query(
      `DELETE FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1 AND id = $2`,
      [portfolioId, photoId]
    );
    if (row.url && row.url.startsWith('portfolio/')) {
      const filePath = path.join(__dirname, '..', 'uploads', row.url);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    }
    res.status(204).send();
  } catch (err) {
    console.error('[Portfolios] DELETE /:id/photos/:photoId error', err);
    return next(err);
  }
});

module.exports = router;
