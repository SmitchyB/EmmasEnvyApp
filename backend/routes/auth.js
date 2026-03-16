const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { signToken, signTempToken, verifyToken } = require('../lib/jwt');
const { requireAuth, requireAuthOrTemp2FA } = require('../middleware/auth');
const { sendOtpEmail } = require('../lib/otp');
const { verify: verifyTotp, generateSecret, getOtpAuthUrl } = require('../lib/totp');
const {
  SESSION_EXPIRY_MS,
  STAY_SIGNED_IN_EXPIRY_MS,
  OTP_EXPIRY_MS,
  SALT_ROUNDS,
  STAY_SIGNED_IN_JWT_EXPIRES_IN,
} = require('../lib/constants');
const { profilePhotoUpload } = require('../lib/upload');

const router = express.Router();
const AUTH_LOG = '[Auth]';

/** Hash device ID for storage and lookup (never store raw device ID). */
function hashDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return null;
  return crypto.createHash('sha256').update(deviceId.trim()).digest('hex');
}

// GET /api/auth/ping – no auth, so you can verify backend is reachable (diagnostics)
router.get('/ping', (req, res) => {
  res.json({ ok: true, service: 'auth', ts: new Date().toISOString() });
});

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

/** Normalize DOB to YYYY-MM-DD. Accepts 8 digits as MMDDYYYY. */
function normalizeDob(dob) {
  if (!dob || typeof dob !== 'string') return dob;
  const trimmed = String(dob).trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8) {
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }
  return trimmed;
}

// POST /api/auth/register
// If two_factor_enabled: optional two_factor_type 'email' | 'phone' | 'totp'. Defaults to email/phone from sign-up method.
router.post('/register', async (req, res, next) => {
  try {
    const { email, phone, password, two_factor_enabled, two_factor_type: reqTwoFactorType } = req.body;
    const useEmail = email != null && String(email).trim() !== '';
    const usePhone = !useEmail && phone != null && normalizePhone(phone);
    if (!useEmail && !usePhone) {
      return res.status(400).json({ error: 'Email or phone is required' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const twoFactorEnabled = !!two_factor_enabled;
    let twoFactorType = null;
    if (twoFactorEnabled) {
      const requested = reqTwoFactorType === 'totp' ? 'totp' : reqTwoFactorType === 'email' ? 'email' : reqTwoFactorType === 'phone' ? 'phone' : null;
      if (requested === 'totp') {
        twoFactorType = 'totp';
      } else if (requested === 'email') {
        if (!useEmail) return res.status(400).json({ error: 'Email 2FA requires signing up with email' });
        twoFactorType = 'email';
      } else if (requested === 'phone') {
        if (!usePhone) return res.status(400).json({ error: 'Phone 2FA requires signing up with phone' });
        twoFactorType = 'phone';
      } else {
        twoFactorType = useEmail ? 'email' : 'phone';
      }
    }

    if (useEmail) {
      const existing = await db.findUserByEmail(email.trim());
      if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    } else {
      const normalized = normalizePhone(phone);
      const existing = await db.findUserByPhone(normalized);
      if (existing) return res.status(409).json({ error: 'An account with this phone number already exists' });
    }

    const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);
    const insertData = {
      email: useEmail ? email.trim() : null,
      phone: usePhone ? normalizePhone(phone) : null,
      password: hashedPassword,
      role: 'customer',
      status: 'active',
      two_factor_enabled: twoFactorEnabled,
      two_factor_type: twoFactorType,
    };

    if (twoFactorType === 'totp') {
      const secret = generateSecret();
      insertData.two_factor_secret = secret;
    }

    const row = await db.insertUser(insertData);
    const user = db.rowToUser(row);
    const sessionToken = crypto.randomUUID();
    const deviceName = db.parseUserAgent(req.get('User-Agent'));
    const ipAddress = db.getClientIp(req);
    const deviceFingerprint = hashDeviceId(req.body.deviceId) || null;
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);
    await db.createAuthSession(user.id, sessionToken, deviceName, deviceFingerprint, ipAddress, true, false, expiresAt);

    if (twoFactorEnabled) {
      const tempToken = signTempToken({ userId: user.id });
      if (twoFactorType === 'totp') {
        const accountName = user.email || user.phone || `user-${user.id}`;
        const totpSetup = { secret: insertData.two_factor_secret, qr_url: getOtpAuthUrl(insertData.two_factor_secret, accountName, 'EmmasEnvy') };
        return res.status(201).json({ requires2FA: true, tempToken, twoFactorType, user, totp_setup: totpSetup });
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
      await db.setOtp(row.id, otp, otpExpiresAt);
      console.log(AUTH_LOG, '2FA OTP (console only, not sent):', otp, '| channel:', twoFactorType);
      return res.status(201).json({ requires2FA: true, tempToken, twoFactorType, user });
    }

    const token = signToken({ userId: user.id, email: user.email, phone: user.phone, sessionId: sessionToken });
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, phone, password, staySignedIn, deviceId } = req.body;
    const useEmail = email != null && String(email).trim() !== '';
    const usePhone = !useEmail && phone != null && normalizePhone(phone);
    if (!useEmail && !usePhone) {
      return res.status(400).json({ error: 'Email or phone is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const row = useEmail
      ? await db.findUserByEmail(email.trim())
      : await db.findUserByPhone(normalizePhone(phone));
    if (!row) return res.status(401).json({ error: 'Invalid email/phone or password' });
    if (row.status !== 'active') return res.status(401).json({ error: 'Account is deactivated' });

    const match = await bcrypt.compare(String(password), row.password);
    if (!match) return res.status(401).json({ error: 'Invalid email/phone or password' });

    await db.updateLastLogin(row.id);
    const user = db.rowToUser(row);

    // If 2FA enabled, check for an active trusted session for this device (session-based trust)
    const deviceIdHash = hashDeviceId(deviceId);
    const trustedSession = deviceIdHash ? await db.findTrustedSessionByUserAndFingerprint(row.id, deviceIdHash) : null;
    const canSkip2FA = user.two_factor_enabled && !!trustedSession;

    if (user.two_factor_enabled) {
      console.log(AUTH_LOG, 'Sign-in 2FA check', {
        userId: row.id,
        deviceIdHashPreview: deviceIdHash ? deviceIdHash.slice(0, 12) + '…' : null,
        hasTrustedSession: !!trustedSession,
        canSkip2FA,
      });
    }

    if (user.two_factor_enabled && !canSkip2FA) {
      if (user.two_factor_type === 'totp') {
        const tempToken = signTempToken({ userId: user.id });
        return res.json({ requires2FA: true, tempToken, twoFactorType: 'totp' });
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
      await db.setOtp(row.id, otp, expiresAt);
      if (user.two_factor_type === 'email' && user.email) {
        await sendOtpEmail(user.email, otp);
      }
      if (user.two_factor_type === 'phone') {
        console.log(AUTH_LOG, '2FA OTP (console only, not sent):', otp, '| channel: phone');
      }
      const tempToken = signTempToken({ userId: user.id });
      return res.json({ requires2FA: true, tempToken, twoFactorType: user.two_factor_type });
    }

    const sessionToken = crypto.randomUUID();
    const deviceName = db.parseUserAgent(req.get('User-Agent'));
    const ipAddress = db.getClientIp(req);
    const useLongSession = !!staySignedIn;
    const sessionExpiryMs = useLongSession ? STAY_SIGNED_IN_EXPIRY_MS : SESSION_EXPIRY_MS;
    const expiresAt = new Date(Date.now() + sessionExpiryMs);
    await db.createAuthSession(user.id, sessionToken, deviceName, deviceIdHash || null, ipAddress, true, canSkip2FA, expiresAt);
    const token = signToken(
      { userId: user.id, email: user.email, phone: user.phone, sessionId: sessionToken },
      useLongSession ? STAY_SIGNED_IN_JWT_EXPIRES_IN : undefined
    );
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout – invalidate current session (requires auth)
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const sessionRowId = req.sessionRowId;
    if (sessionRowId != null) {
      await db.deleteSessionById(sessionRowId, req.user.id);
    }
    res.json({ message: 'Signed out.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    const decoded = verifyToken(token);
    if (!decoded || !decoded.temp2FA) {
      return res.status(401).json({ error: 'Invalid or expired verification token' });
    }

    const { code, rememberDevice, deviceId } = req.body;
    const trimmed = String(code || '').replace(/\D/g, '');
    if (trimmed.length < 6) {
      return res.status(400).json({ error: 'Please enter at least 6 digits' });
    }

    // Only add device to trusted set when rememberDevice is checked (store hash, not raw ID)
    const deviceIdHash = hashDeviceId(deviceId);

    const row = await db.findUserById(decoded.userId);
    if (!row || row.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    if (row.two_factor_type === 'totp' && row.two_factor_secret) {
      if (!verifyTotp(trimmed, row.two_factor_secret)) {
        return res.status(401).json({ error: 'Invalid code' });
      }
    } else {
      if (!row.otp || !row.otp_expires) {
        return res.status(400).json({ error: 'No verification pending or code expired' });
      }
      const expiresAt = new Date(row.otp_expires);
      if (expiresAt < new Date()) {
        await db.clearOtp(row.id);
        return res.status(400).json({ error: 'Code has expired. Please sign in again.' });
      }
      if (trimmed !== row.otp) {
        return res.status(401).json({ error: 'Invalid code' });
      }
      await db.clearOtp(row.id);
    }
    const user = db.rowToUser(row);

    // "Remember this device" is stored only on the session row (is_trusted_device); no ignore_2fa_devices
    console.log(AUTH_LOG, 'Verify-2FA result', {
      userId: row.id,
      rememberDevice: !!rememberDevice,
      deviceIdHashPreview: deviceIdHash ? deviceIdHash.slice(0, 12) + '…' : null,
    });

    const sessionToken = crypto.randomUUID();
    const deviceName = db.parseUserAgent(req.get('User-Agent'));
    const ipAddress = db.getClientIp(req);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);
    await db.createAuthSession(user.id, sessionToken, deviceName, deviceIdHash || null, ipAddress, true, !!rememberDevice, expiresAt);
    const fullToken = signToken({ userId: user.id, email: user.email, phone: user.phone, sessionId: sessionToken });
    res.json({ user, token: fullToken });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me (requires auth - returns current user)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/sessions – list active sessions for the logged-in user (device name, trusted status)
router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const sessions = await db.getAuthSessionsForUser(req.user.id, req.sessionId || null);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/sessions/:id – revoke (log out) a specific device
router.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }
    const deleted = await db.deleteSessionById(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ message: 'Session revoked.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/sessions/:id/untrust – set is_trusted_device to false (force 2FA on next login for that device)
router.patch('/sessions/:id/untrust', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }
    const updated = await db.updateSessionTrusted(id, req.user.id, false);
    if (!updated) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ message: 'Device untrusted. Two-factor will be required on next login.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me/2fa – enable/disable 2FA and set type (email, phone, totp). For totp, generates secret and returns setup info.
// When disabling 2FA or changing 2FA type, current_password is required and verified.
router.patch('/me/2fa', requireAuth, async (req, res, next) => {
  try {
    const { two_factor_enabled, two_factor_type, current_password } = req.body;
    const data = {};
    if (two_factor_enabled !== undefined) data.two_factor_enabled = !!two_factor_enabled;
    let twoFactorType = null;
    if (two_factor_type !== undefined) {
      twoFactorType = two_factor_type === 'phone' || two_factor_type === 'sms' ? 'phone' : two_factor_type === 'email' ? 'email' : two_factor_type === 'totp' ? 'totp' : null;
      data.two_factor_type = twoFactorType;
    }
    if (Object.keys(data).length === 0) {
      const row = await db.findUserById(req.user.id);
      return res.json({ user: db.rowToUser(row) });
    }

    const isDisabling = data.two_factor_enabled === false;
    const isChangingType = twoFactorType != null && req.user.two_factor_enabled;
    if (isDisabling || isChangingType) {
      if (!current_password || String(current_password).trim() === '') {
        return res.status(400).json({ error: 'Enter your current password to continue.' });
      }
      const row = await db.findUserById(req.user.id);
      if (!row || !row.password) {
        return res.status(400).json({ error: 'Password verification is not available for this account.' });
      }
      const passwordMatch = await bcrypt.compare(String(current_password).trim(), row.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    // Require email/phone on account when setting 2FA type to email/phone
    if (twoFactorType === 'email' && data.two_factor_enabled !== false) {
      if (!req.user.email || String(req.user.email).trim() === '') {
        return res.status(400).json({ error: 'Add an email to your account first to use email for 2FA codes.' });
      }
    }
    if (twoFactorType === 'phone' && data.two_factor_enabled !== false) {
      if (!req.user.phone || String(req.user.phone).trim() === '') {
        return res.status(400).json({ error: 'Add a phone number to your account first to use phone for 2FA codes.' });
      }
    }
    let totpSetup = null;
    if (twoFactorType === 'totp' && data.two_factor_enabled !== false) {
      const secret = generateSecret();
      data.two_factor_secret = secret;
      const accountName = req.user.email || req.user.phone || `user-${req.user.id}`;
      totpSetup = { secret, qr_url: getOtpAuthUrl(secret, accountName, 'EmmasEnvy') };
    }
    await db.updateUser2FA(req.user.id, data);
    const row = await db.findUserById(req.user.id);
    const payload = { user: db.rowToUser(row) };
    if (totpSetup) payload.totp_setup = totpSetup;
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me (profile only: first_name, last_name, dob – no password required)
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { first_name, last_name, dob } = req.body;
    const data = {};
    if (first_name !== undefined) data.first_name = String(first_name).trim();
    if (last_name !== undefined) data.last_name = String(last_name).trim();
    if (dob !== undefined) data.dob = dob != null ? String(dob).trim() : null;
    if (Object.keys(data).length === 0) {
      const row = await db.findUserById(req.user.id);
      return res.json({ user: db.rowToUser(row) });
    }
    await db.updateProfile(req.user.id, data);
    const row = await db.findUserById(req.user.id);
    res.json({ user: db.rowToUser(row) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/profile-photo (requires auth, multipart field "photo")
router.post('/profile-photo', requireAuth, profilePhotoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' });
    }
    const relativePath = path.join('profile_photos', req.file.filename).split(path.sep).join('/');
    const previous = req.user.profile_picture;
    if (previous && previous.startsWith('profile_photos/')) {
      const oldPath = path.join(__dirname, '..', 'uploads', previous);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (_) {}
    }
    await db.updateProfile(req.user.id, { profile_picture: relativePath });
    const row = await db.findUserById(req.user.id);
    const user = db.rowToUser(row);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/account (email, phone, password – requires current_password when changing any)
router.patch('/account', requireAuth, async (req, res, next) => {
  try {
    const { current_password, email, phone, new_password, confirm_password } = req.body;
    const wantEmail = email !== undefined && String(email).trim() !== '';
    const wantPhone = phone !== undefined;
    const wantPassword = new_password !== undefined && String(new_password).length > 0;
    if (!wantEmail && !wantPhone && !wantPassword) {
      const row = await db.findUserById(req.user.id);
      return res.json({ user: db.rowToUser(row) });
    }

    const row = await db.findUserById(req.user.id);
    if (!row || !row.password) {
      return res.status(400).json({ error: 'Current password is required to change email, phone, or password.' });
    }
    if (!current_password || String(current_password).length === 0) {
      return res.status(400).json({ error: 'Current password is required to change email, phone, or password.' });
    }
    const passwordMatch = await bcrypt.compare(String(current_password), row.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const data = {};
    if (wantEmail) {
      const newEmail = String(email).trim();
      if (newEmail !== (row.email || '')) {
        const existing = await db.findUserByEmail(newEmail);
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        data.email = newEmail;
      }
    }
    if (wantPhone) {
      const normalized = normalizePhone(String(phone || ''));
      const newPhone = normalized || (phone != null && String(phone).trim() !== '' ? String(phone).trim() : null);
      if (newPhone !== (row.phone || '')) {
        if (normalized && normalized.length >= 10) {
          const existing = await db.findUserByPhone(normalized);
          if (existing && existing.id !== req.user.id) {
            return res.status(409).json({ error: 'An account with this phone number already exists.' });
          }
        }
        data.phone = normalized || newPhone || null;
      }
    }
    if (wantPassword) {
      const newPass = String(new_password);
      if (newPass.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      if (newPass !== (confirm_password != null ? String(confirm_password) : '')) {
        return res.status(400).json({ error: 'New password and confirmation do not match.' });
      }
      data.password = await bcrypt.hash(newPass, SALT_ROUNDS);
    }

    if (Object.keys(data).length > 0) {
      await db.updateProfile(req.user.id, data);
    }
    const updated = await db.findUserById(req.user.id);
    res.json({ user: db.rowToUser(updated) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/complete-profile (requires auth - full or temp token for new signups)
// Required: first_name, dob. Optional: last_name, phone, email, profile_picture.
router.post('/complete-profile', requireAuthOrTemp2FA, async (req, res, next) => {
  try {
    const { first_name, last_name, dob, phone, email, profile_picture } = req.body;
    if (!first_name || String(first_name).trim() === '') {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (!dob || String(dob).trim() === '') {
      return res.status(400).json({ error: 'Date of birth is required' });
    }
    const data = {
      first_name: String(first_name).trim(),
      dob: normalizeDob(dob),
    };
    if (last_name !== undefined) data.last_name = String(last_name).trim();
    if (phone != null && String(phone).trim() !== '') {
      const normalized = normalizePhone(String(phone));
      data.phone = normalized || String(phone).trim();
    }
    if (email != null && String(email).trim() !== '') {
      data.email = String(email).trim();
    }
    if (profile_picture != null && String(profile_picture).trim() !== '') {
      data.profile_picture = String(profile_picture).trim();
    }
    if (data.email) {
      const existing = await db.findUserByEmail(data.email);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
    }
    if (data.phone) {
      const normalized = normalizePhone(data.phone);
      if (normalized && normalized.length >= 10) {
        const existing = await db.findUserByPhone(normalized);
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'An account with this phone number already exists.' });
        }
        data.phone = normalized;
      }
    }
    await db.updateProfile(req.user.id, data);
    const row = await db.findUserById(req.user.id);
    const user = db.rowToUser(row);

    // If request used a temp token (e.g. skipped 2FA at signup), issue full token; otherwise just return user.
    const token = req.isTemp2FA
      ? signToken({ userId: user.id, email: user.email, phone: user.phone })
      : undefined;
    if (token) {
      return res.json({ user, token });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
