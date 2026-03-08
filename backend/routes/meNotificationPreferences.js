/**
 * User notification preferences: GET and PATCH for current user.
 * GET /api/me/notification-preferences
 * PATCH /api/me/notification-preferences
 */

const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_KEYS = [
  'notify_email',
  'notify_text',
  'notify_push',
  'login_alerts',
  'newsletter',
  'rewards_usage_earning',
  'reminders_apts',
  'promotions',
  'admin_new_appointment',
  'admin_new_order',
  'admin_ticket_new',
  'admin_ticket_message',
  'admin_rescheduled_apt',
];

// GET /api/me/notification-preferences
router.get('/notification-preferences', requireAuth, async (req, res, next) => {
  try {
    const prefs = await db.getNotificationPreferences(req.user.id);
    res.json({ preferences: prefs });
  } catch (err) {
    console.error('[meNotificationPreferences] GET error', err);
    return next(err);
  }
});

// PATCH /api/me/notification-preferences
router.patch('/notification-preferences', requireAuth, async (req, res, next) => {
  try {
    const body = req.body?.preferences ?? req.body ?? {};
    const data = {};
    const isAdmin = req.user.role && String(req.user.role).toLowerCase() === 'admin';
    for (const key of ALLOWED_KEYS) {
      if (body[key] === undefined) continue;
      if (key.startsWith('admin_') && !isAdmin) continue;
      data[key] = !!body[key];
    }
    await db.upsertNotificationPreferences(req.user.id, data);
    const prefs = await db.getNotificationPreferences(req.user.id);
    res.json({ preferences: prefs });
  } catch (err) {
    console.error('[meNotificationPreferences] PATCH error', err);
    return next(err);
  }
});

module.exports = router;
