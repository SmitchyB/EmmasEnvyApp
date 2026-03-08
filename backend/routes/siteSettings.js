/**
 * Site settings: public GET; admin PATCH and home hero upload.
 * GET /api/site-settings – public (products_enabled, rewards_enabled, home hero, five policies).
 * PATCH /api/site-settings – admin only.
 * POST /api/site-settings/home-hero – admin only, multipart image.
 */

const path = require('path');
const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { homeHeroUpload } = require('../lib/upload');

const router = express.Router();

function rowToPublic(row) {
  if (!row) return null;
  return {
    products_enabled: row.products_enabled === true,
    rewards_enabled: row.rewards_enabled === true,
    home_hero_image: row.home_hero_image ?? null,
    hero_title: row.hero_title ?? null,
    home_hero_material: row.home_hero_material ?? null,
    policy_appointment_cancellation: row.policy_appointment_cancellation ?? null,
    policy_service_guarantee_fix: row.policy_service_guarantee_fix ?? null,
    policy_shipping_fulfillment: row.policy_shipping_fulfillment ?? null,
    policy_rewards_loyalty: row.policy_rewards_loyalty ?? null,
    policy_privacy: row.policy_privacy ?? null,
  };
}

// GET /api/site-settings – public this gets the site settings from the database set by the admin.
router.get('/', async (req, res, next) => {
  try {
    let row = await db.getSiteSettings(); // Get the site settings from the database
    // If the site settings are not found, create a new row
    if (!row) {
      try {
        await db.ensureSiteSettingsRow(); // Ensure the site settings row exists
        row = await db.getSiteSettings(); // Get the site settings from the database
      } catch (ensureErr) {
        console.error('[siteSettings] GET / ensure row failed', ensureErr?.message || ensureErr); // Log the error
      }
    }
    // If the site settings are not found, return a 503 error
    if (!row) {
      return res.status(503).json({
        error: 'Site settings not available',
        products_enabled: true,
        rewards_enabled: true,
        home_hero_image: null,
        hero_title: null,
        home_hero_material: null,
        policy_appointment_cancellation: null,
        policy_service_guarantee_fix: null,
        policy_shipping_fulfillment: null,
        policy_rewards_loyalty: null,
        policy_privacy: null,
      });
    }
    res.json(rowToPublic(row)); // Return the site settings as a JSON object
  } catch (err) {
    console.error('[siteSettings] GET / error', err?.message || err); // Log the error
    return next(err); // Pass the error to the next middleware
  }
});

// PATCH /api/site-settings – admin only
router.patch('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (Object.keys(body).length > 0) {
      console.log('[siteSettings] PATCH body keys:', Object.keys(body));
    }
    const data = {};
    const allowed = [
      'products_enabled',
      'rewards_enabled',
      'home_hero_image',
      'hero_title',
      'home_hero_material',
      'policy_appointment_cancellation',
      'policy_service_guarantee_fix',
      'policy_shipping_fulfillment',
      'policy_rewards_loyalty',
      'policy_privacy',
    ];
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      if (key === 'products_enabled' || key === 'rewards_enabled') {
        data[key] = !!body[key];
      } else {
        data[key] = body[key] == null ? null : String(body[key]);
      }
    }
    if (Object.keys(data).length === 0) {
      const row = await db.getSiteSettings();
      return res.json(rowToPublic(row));
    }
    await db.updateSiteSettings(data);
    const row = await db.getSiteSettings();
    res.json(rowToPublic(row));
  } catch (err) {
    console.error('[siteSettings] PATCH / error', err?.message || err, err?.stack);
    return next(err);
  }
});

// POST /api/site-settings/home-hero – admin only, multipart "image"
router.post('/home-hero', requireAuth, requireAdmin, (req, res, next) => {
  homeHeroUpload.single('image')(req, res, (multerErr) => {
    if (multerErr) {
      console.error('[siteSettings] POST /home-hero multer error', multerErr?.message || multerErr);
      return res.status(400).json({
        error: 'File upload failed',
        detail: process.env.NODE_ENV !== 'production' ? (multerErr?.message || String(multerErr)) : undefined,
      });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart field "image".' });
    }
    const relativePath = 'home_hero/' + req.file.filename;
    console.log('[siteSettings] POST /home-hero saved file:', req.file.path || req.file.filename, '-> DB path:', relativePath);
    const current = await db.getSiteSettings();
    const previous = current?.home_hero_image;
    if (previous && typeof previous === 'string' && previous.startsWith('home_hero/')) {
      const oldPath = path.join(__dirname, '..', 'uploads', previous);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (_) {}
    }
    await db.updateSiteSettings({ home_hero_image: relativePath });
    const row = await db.getSiteSettings();
    res.json(rowToPublic(row));
  } catch (err) {
    console.error('[siteSettings] POST /home-hero error', err?.message || err, err?.stack);
    return next(err);
  }
});

module.exports = router;
