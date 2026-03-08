const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const USER_ADDRESSES_TABLE = 'emmasenvy.user_addresses';

// GET /api/me/addresses – list addresses for current user
router.get('/addresses', requireAuth, async (req, res, next) => {
  try {
    const result = await db.pool.query(
      `SELECT id, full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone_number, created_at
       FROM ${USER_ADDRESSES_TABLE}
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.user.id]
    );
    const addresses = result.rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      address_line_1: row.address_line_1,
      address_line_2: row.address_line_2 ?? null,
      city: row.city,
      state_province: row.state_province,
      zip_postal_code: row.zip_postal_code,
      country: row.country ?? null,
      phone: row.phone_number ?? null,
      created_at: row.created_at,
    }));
    res.json({ addresses });
  } catch (err) {
    console.error('[meAddresses] GET /addresses error', err);
    return next(err);
  }
});

// POST /api/me/addresses – create address for current user
router.post('/addresses', requireAuth, async (req, res, next) => {
  try {
    const { full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone } = req.body || {};
    const fullName = full_name != null ? String(full_name).trim() : '';
    const line1 = address_line_1 != null ? String(address_line_1).trim() : '';
    const cityStr = city != null ? String(city).trim() : '';
    const stateStr = state_province != null ? String(state_province).trim() : '';
    const zipStr = zip_postal_code != null ? String(zip_postal_code).trim() : '';
    const countryStr = country != null ? String(country).trim() : '';
    if (!fullName || !line1 || !cityStr || !stateStr || !zipStr || !countryStr) {
      return res.status(400).json({
        error: 'full_name, address_line_1, city, state_province, zip_postal_code, and country are required',
      });
    }
    const phoneVal = phone != null && String(phone).trim() ? String(phone).trim() : null;
    const result = await db.pool.query(
      `INSERT INTO ${USER_ADDRESSES_TABLE} (user_id, full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone_number, created_at`,
      [
        req.user.id,
        fullName,
        line1,
        address_line_2 != null ? String(address_line_2).trim() : null,
        cityStr,
        stateStr,
        zipStr,
        countryStr,
        phoneVal,
      ]
    );
    const row = result.rows[0];
    res.status(201).json({
      address: {
        id: row.id,
        full_name: row.full_name,
        address_line_1: row.address_line_1,
        address_line_2: row.address_line_2 ?? null,
        city: row.city,
        state_province: row.state_province,
        zip_postal_code: row.zip_postal_code,
        country: row.country ?? null,
        phone: row.phone_number ?? null,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('[meAddresses] POST /addresses error', err);
    return next(err);
  }
});

// PATCH /api/me/addresses/:id – update address (own only)
router.patch('/addresses/:id', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid address id' });
  }
  try {
    const { full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone } = req.body || {};
    const fullName = full_name != null ? String(full_name).trim() : '';
    const line1 = address_line_1 != null ? String(address_line_1).trim() : '';
    const cityStr = city != null ? String(city).trim() : '';
    const stateStr = state_province != null ? String(state_province).trim() : '';
    const zipStr = zip_postal_code != null ? String(zip_postal_code).trim() : '';
    const countryStr = country != null ? String(country).trim() : '';
    if (!fullName || !line1 || !cityStr || !stateStr || !zipStr || !countryStr) {
      return res.status(400).json({
        error: 'full_name, address_line_1, city, state_province, zip_postal_code, and country are required',
      });
    }
    const phoneVal = phone != null && String(phone).trim() ? String(phone).trim() : null;
    const result = await db.pool.query(
      `UPDATE ${USER_ADDRESSES_TABLE}
       SET full_name = $1, address_line_1 = $2, address_line_2 = $3, city = $4, state_province = $5, zip_postal_code = $6, country = $7, phone_number = $8, updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING id, full_name, address_line_1, address_line_2, city, state_province, zip_postal_code, country, phone_number, created_at, updated_at`,
      [fullName, line1, address_line_2 != null ? String(address_line_2).trim() : null, cityStr, stateStr, zipStr, countryStr, phoneVal, id, req.user.id]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Address not found' });
    }
    res.json({
      address: {
        id: row.id,
        full_name: row.full_name,
        address_line_1: row.address_line_1,
        address_line_2: row.address_line_2 ?? null,
        city: row.city,
        state_province: row.state_province,
        zip_postal_code: row.zip_postal_code,
        country: row.country ?? null,
        phone: row.phone_number ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[meAddresses] PATCH /addresses/:id error', err);
    return next(err);
  }
});

// DELETE /api/me/addresses/:id – delete address (own only)
router.delete('/addresses/:id', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid address id' });
  }
  try {
    const result = await db.pool.query(
      `DELETE FROM ${USER_ADDRESSES_TABLE} WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Address not found' });
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[meAddresses] DELETE /addresses/:id error', err);
    return next(err);
  }
});

module.exports = router;
