const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Map a DB row to a safe user object.
 * @param {object} row - Raw row from emmasenvy.users
 * @returns {object} Safe user for API responses
 */
// Define the rowToUser function
function rowToUser(row) {
  if (!row) return null; // If the row is not found, return null
  const user = {
    id: row.id, // Set the id of the user
    first_name: row.first_name, // Set the first name of the user
    last_name: row.last_name, // Set the last name of the user
    dob: row.dob, // Set the date of birth of the user
    phone: row.phone, // Set the phone of the user
    profile_picture: row.profile_picture,
    email: row.email, // Set the email of the user
    role: row.role, // Set the role of the user
    two_factor_type: row.two_factor_type, // Set the two factor type of the user
    two_factor_enabled: row.two_factor_enabled === true,
    status: row.status, // Set the status of the user
    last_login: row.last_login, // Set the last login of the user
    created_at: row.created_at, // Set the created at of the user
    updated_at: row.updated_at, // Set the updated at of the user
    reward_points: row.reward_points != null ? parseInt(row.reward_points, 10) : 0, // Set the reward points of the user
  };
  return user; // Return the user object
}

const USERS_TABLE = 'emmasenvy.users'; // Define the users table

// Define the findUserById function
async function findUserById(id) {
  // Query the users table for the user with the given id
  const result = await pool.query(
    'SELECT * FROM ' + USERS_TABLE + ' WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}
// Define the findUserByEmail function that queries the users table for the user with the given email
async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM ' + USERS_TABLE + ' WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

// Define the findUserByPhone function that queries the users table for the user with the given phone number
async function findUserByPhone(phone) {
  const result = await pool.query(
    'SELECT * FROM ' + USERS_TABLE + ' WHERE phone = $1',
    [phone]
  );
  return result.rows[0] || null;
}

/**
 * Insert a new user. Returns the inserted row.
 * @param {object} data - email or phone, password (hashed), role, status, two_factor_enabled, two_factor_type, etc.
 */
async function insertUser(data) {
  const now = new Date();
  const result = await pool.query(
    `INSERT INTO ${USERS_TABLE} (
      first_name, last_name, dob, phone, profile_picture,
      email, password, role, two_factor_type, two_factor_enabled, two_factor_secret,
      otp, otp_expires,
      status, last_login, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
    ) RETURNING *`,
    [
      data.first_name ?? null,
      data.last_name ?? null,
      data.dob ?? null,
      data.phone ?? null,
      data.profile_picture ?? null,
      data.email ?? null,
      data.password ?? null,
      data.role ?? 'customer',
      data.two_factor_type ?? null,
      data.two_factor_enabled ?? false,
      data.two_factor_secret ?? null,
      data.otp ?? null,
      data.otp_expires ?? null,
      data.status ?? 'active',
      data.last_login ?? null,
      now,
      now,
    ]
  );
  return result.rows[0];
}

async function updateLastLogin(userId) {
  const now = new Date();
  await pool.query(
    'UPDATE ' + USERS_TABLE + ' SET last_login = $1, updated_at = $2 WHERE id = $3',
    [now, now, userId]
  );
}

async function setOtp(userId, otp, expiresAt) {
  const now = new Date();
  await pool.query(
    'UPDATE ' + USERS_TABLE + ' SET otp = $1, otp_expires = $2, updated_at = $3 WHERE id = $4',
    [otp, expiresAt, now, userId]
  );
}

async function clearOtp(userId) {
  const now = new Date();
  await pool.query(
    'UPDATE ' + USERS_TABLE + ' SET otp = NULL, otp_expires = NULL, updated_at = $1 WHERE id = $2',
    [now, userId]
  );
}

async function updateProfile(userId, data) {
  const now = new Date();
  const fields = ['first_name', 'last_name', 'dob', 'phone', 'profile_picture', 'email', 'password'];
  const allowed = fields.filter((f) => data[f] !== undefined);
  if (allowed.length === 0) return;
  const setClause = allowed.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = allowed.map((f) => data[f]);
  const updatedAtIdx = values.length + 1;
  const idIdx = values.length + 2;
  values.push(now, userId);
  await pool.query(
    `UPDATE ${USERS_TABLE} SET ${setClause}, updated_at = $${updatedAtIdx} WHERE id = $${idIdx}`,
    values
  );
}

async function updateUser2FA(userId, data) {
  const now = new Date();
  const updates = [];
  const values = [];
  let idx = 1;
  if (data.two_factor_enabled !== undefined) {
    updates.push(`two_factor_enabled = $${idx++}`);
    values.push(!!data.two_factor_enabled);
  }
  if (data.two_factor_type !== undefined) {
    const t = data.two_factor_type;
    const valid = t === 'email' || t === 'phone' || t === 'totp' ? t : null;
    updates.push(`two_factor_type = $${idx++}`);
    values.push(valid);
  }
  if (data.two_factor_secret !== undefined) {
    updates.push(`two_factor_secret = $${idx++}`);
    values.push(data.two_factor_secret == null ? null : String(data.two_factor_secret));
  }
  if (updates.length === 0) return;
  values.push(now, userId);
  await pool.query(
    `UPDATE ${USERS_TABLE} SET ${updates.join(', ')}, updated_at = $${idx} WHERE id = $${idx + 1}`,
    values
  );
}

const SITE_SETTINGS_TABLE = 'emmasenvy.site_settings'; // Define the site settings table

/**
 * Ensure the single site_settings row (id = 1) exists. Call before any update so PATCH/hero upload never target a missing row.
 */
async function ensureSiteSettingsRow() {
  await pool.query(
    `INSERT INTO ${SITE_SETTINGS_TABLE} (id, rewards_enabled, updated_at)
     VALUES (1, true, NOW())
     ON CONFLICT (id) DO NOTHING`
  );
}

/**
 * Get the single site_settings row (id = 1). Returns null if table/row missing.
 */
async function getSiteSettings() {
  const result = await pool.query(
    'SELECT * FROM ' + SITE_SETTINGS_TABLE + ' WHERE id = 1'
  );
  return result.rows[0] || null;
}

/**
 * Update site_settings row. Only updates provided fields. Ensures row exists first.
 */
async function updateSiteSettings(data) {
  const allowed = [
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
  const updates = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    updates.push(`${key} = $${idx}`);
    values.push(data[key]);
    idx += 1;
  }
  if (updates.length === 0) return;
  await ensureSiteSettingsRow();
  updates.push(`updated_at = $${idx}`);
  values.push(new Date());
  idx += 1;
  values.push(1);
  const result = await pool.query(
    `UPDATE ${SITE_SETTINGS_TABLE} SET ${updates.join(', ')} WHERE id = $${idx}`,
    values
  );
  if (result.rowCount === 0) {
    throw new Error('site_settings: update affected 0 rows (row id=1 missing?)');
  }
}

const USER_NOTIFICATION_PREFS_TABLE = 'emmasenvy.user_notification_preferences';

const NOTIFICATION_PREFS_DEFAULTS = {
  notify_email: true,
  notify_text: false,
  notify_push: false,
  login_alerts: true,
  newsletter: true,
  rewards_usage_earning: true,
  reminders_apts: true,
  promotions: true,
  admin_new_appointment: true,
  admin_new_order: true,
  admin_ticket_new: true,
  admin_ticket_message: true,
  admin_rescheduled_apt: true,
};

async function getNotificationPreferences(userId) {
  const result = await pool.query(
    'SELECT * FROM ' + USER_NOTIFICATION_PREFS_TABLE + ' WHERE user_id = $1',
    [userId]
  );
  const row = result.rows[0];
  if (row) {
    return {
      notify_email: row.notify_email === true,
      notify_text: row.notify_text === true,
      notify_push: row.notify_push === true,
      login_alerts: row.login_alerts !== false,
      newsletter: row.newsletter === true,
      rewards_usage_earning: row.rewards_usage_earning === true,
      reminders_apts: row.reminders_apts === true,
      promotions: row.promotions === true,
      admin_new_appointment: row.admin_new_appointment === true,
      admin_new_order: row.admin_new_order === true,
      admin_ticket_new: row.admin_ticket_new === true,
      admin_ticket_message: row.admin_ticket_message === true,
      admin_rescheduled_apt: row.admin_rescheduled_apt === true,
    };
  }
  return { ...NOTIFICATION_PREFS_DEFAULTS };
}

async function upsertNotificationPreferences(userId, data) {
  const now = new Date();
  const allowed = [
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
  const merged = { ...NOTIFICATION_PREFS_DEFAULTS, ...data };
  const cols = ['user_id', 'updated_at', ...allowed];
  const vals = [userId, now, ...allowed.map((k) => !!merged[k])];
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const conflictSet = ['updated_at', ...allowed].map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  await pool.query(
    `INSERT INTO ${USER_NOTIFICATION_PREFS_TABLE} (${cols.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (user_id) DO UPDATE SET ${conflictSet}`,
    vals
  );
}

const USER_SESSIONS_TABLE = 'emmasenvy.user_sessions';

function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return 'Unknown device';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'Mobile';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/edge/i.test(ua)) return 'Edge';
  return 'Browser';
}

function getClientIp(req) {
  if (!req) return null;
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

/**
 * Create a session row. sessionToken = UUID stored in JWT.
 * expiresAt = Date (e.g. now + 7 days).
 */
async function createAuthSession(userId, sessionToken, deviceName, deviceFingerprint, ipAddress, is2faVerified, isTrustedDevice, expiresAt) {
  await pool.query(
    `INSERT INTO ${USER_SESSIONS_TABLE}
     (user_id, session_token, device_name, device_fingerprint, ip_address, is_2fa_verified, is_trusted_device, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      sessionToken,
      deviceName || 'Unknown device',
      deviceFingerprint || null,
      ipAddress || null,
      !!is2faVerified,
      !!isTrustedDevice,
      expiresAt,
    ]
  );
}

/**
 * Find an active, trusted session for this user + device fingerprint (to skip 2FA on login).
 */
async function findTrustedSessionByUserAndFingerprint(userId, deviceFingerprint) {
  if (!deviceFingerprint || typeof deviceFingerprint !== 'string') return null;
  const now = new Date();
  const result = await pool.query(
    `SELECT id FROM ${USER_SESSIONS_TABLE}
     WHERE user_id = $1 AND device_fingerprint = $2 AND is_trusted_device = true AND expires_at > $3
     LIMIT 1`,
    [userId, deviceFingerprint.trim(), now]
  );
  return result.rows[0] || null;
}

/**
 * Find session by user + session_token (for middleware validation).
 */
async function findSessionByToken(userId, sessionToken) {
  if (!sessionToken) return null;
  const now = new Date();
  const result = await pool.query(
    `SELECT id, session_token, device_name, is_trusted_device, expires_at FROM ${USER_SESSIONS_TABLE}
     WHERE user_id = $1 AND session_token = $2 AND expires_at > $3`,
    [userId, sessionToken, now]
  );
  return result.rows[0] || null;
}

/**
 * List active sessions for user. currentSessionToken used to mark current session.
 */
async function getAuthSessionsForUser(userId, currentSessionToken) {
  const now = new Date();
  const result = await pool.query(
    `SELECT id, session_token, device_name, is_trusted_device, expires_at FROM ${USER_SESSIONS_TABLE}
     WHERE user_id = $1 AND expires_at > $2 ORDER BY expires_at DESC`,
    [userId, now]
  );
  return result.rows.map((r) => ({
    id: r.id,
    session_token: r.session_token,
    device_name: r.device_name || 'Unknown device',
    is_trusted_device: r.is_trusted_device === true,
    expires_at: r.expires_at,
    current: r.session_token === currentSessionToken,
  }));
}

/**
 * Set is_trusted_device for a session (own session only).
 */
async function updateSessionTrusted(sessionId, userId, isTrusted) {
  const result = await pool.query(
    `UPDATE ${USER_SESSIONS_TABLE} SET is_trusted_device = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
    [!!isTrusted, sessionId, userId]
  );
  return result.rowCount > 0;
}

/**
 * Delete a session by id (own session only). Returns true if deleted.
 */
async function deleteSessionById(sessionId, userId) {
  const result = await pool.query(
    `DELETE FROM ${USER_SESSIONS_TABLE} WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return result.rowCount > 0;
}

/** Revoke all active sessions for a user (e.g. after password reset). */
async function deleteAllSessionsForUser(userId) {
  await pool.query(`DELETE FROM ${USER_SESSIONS_TABLE} WHERE user_id = $1`, [userId]);
}

module.exports = {
  pool,
  rowToUser,
  findUserById,
  findUserByEmail,
  findUserByPhone,
  insertUser,
  updateLastLogin,
  setOtp,
  clearOtp,
  updateProfile,
  updateUser2FA,
  ensureSiteSettingsRow,
  getSiteSettings,
  updateSiteSettings,
  getNotificationPreferences,
  upsertNotificationPreferences,
  parseUserAgent,
  getClientIp,
  createAuthSession,
  findTrustedSessionByUserAndFingerprint,
  findSessionByToken,
  getAuthSessionsForUser,
  updateSessionTrusted,
  deleteSessionById,
  deleteAllSessionsForUser,
};
