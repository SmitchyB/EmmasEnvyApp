const path = require('path'); // for path
const fs = require('fs'); // for file system
const crypto = require('crypto'); // for crypto
const express = require('express'); // for express
const bcrypt = require('bcryptjs'); // for bcrypt
const db = require('../lib/db'); // for database
const { signToken, signTempToken, signPasswordResetToken, verifyToken } = require('../lib/jwt'); // for jwt
const { requireAuth, requireAuthOrTemp2FA } = require('../middleware/auth'); // for authentication
const { sendOtpEmail } = require('../lib/otp'); // for otp
const { verify: verifyTotp, generateSecret, getOtpAuthUrl } = require('../lib/totp'); // for totp
const {
  SESSION_EXPIRY_MS, // for session expiry
  STAY_SIGNED_IN_EXPIRY_MS, // for stay signed in expiry
  OTP_EXPIRY_MS, // for otp expiry
  SALT_ROUNDS, // for salt rounds
  STAY_SIGNED_IN_JWT_EXPIRES_IN, // for stay signed in jwt expiry
} = require('../lib/constants');
const { profilePhotoUpload } = require('../lib/upload'); // for upload
const router = express.Router(); // for router
const AUTH_LOG = '[Auth]'; // for authentication log
const RESET_TOTP_PENDING = '__reset_totp_pending__'; // for reset totp pending
const FORGOT_PASSWORD_GENERIC_MESSAGE = 'If an account exists, a verification code has been sent or use your authenticator app if you use two-factor authentication.'; // for forgot password generic message
const forgotIpBuckets = new Map(); // for forgot ip buckets
const FORGOT_IP_MAX = 25; // for forgot ip max
const FORGOT_IP_WINDOW_MS = 15 * 60 * 1000; // for forgot ip window ms
const forgotIdentifierLast = new Map(); // for forgot identifier last
const FORGOT_ID_MIN_MS = 5 * 60 * 1000; // for forgot id min ms
const resetIpBuckets = new Map(); // for reset ip buckets
const RESET_IP_MAX = 30; // for reset ip max
const RESET_IP_WINDOW_MS = 15 * 60 * 1000; // for reset ip window ms

// Function to sleep for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms)); // return a promise that resolves after the given number of milliseconds
}

// Function to generate a random integer between a given minimum and maximum
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1)); // return a random integer between the given minimum and maximum
}

// Function to take an ip bucket
function takeIpBucket(map, ip, max, windowMs) {
  const now = Date.now(); // set now to the current time
  const key = ip || 'unknown'; // get the key
  let b = map.get(key); // get the bucket
  // if the bucket is not found or the window time is greater than the window ms
  if (!b || now - b.windowStart > windowMs) {
    b = { count: 0, windowStart: now }; // set the bucket to the current time
  }
  if (b.count >= max) return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - b.windowStart)) / 1000) }; // if the count is greater than the max, return false and the retry after seconds
  b.count += 1; // increment the count
  map.set(key, b); // set the bucket to the key
  return { ok: true }; // return true
}

// Function to throttle an identifier
function throttleIdentifier(normalizedId) {
  if (!normalizedId) return { ok: true }; // if the normalized id is not found, return true
  const now = Date.now(); // set now to the current time
  const last = forgotIdentifierLast.get(normalizedId); // get the last identifier
  // if the last identifier is not found or the time is greater than the forgot id min ms
  if (last != null && now - last < FORGOT_ID_MIN_MS) {
    return { ok: false, retryAfterSec: Math.ceil((FORGOT_ID_MIN_MS - (now - last)) / 1000) }; // if the time is greater than the forgot id min ms, return false and the retry after seconds
  }
  forgotIdentifierLast.set(normalizedId, now); // set the last identifier to the current time
  return { ok: true }; // return true
}

// Function to normalize an email for lookup
function normalizeEmailForLookup(email) {
  if (!email || typeof email !== 'string') return ''; // if the email is not found or the type is not a string, return an empty string
  return email.trim(); // return the email trimmed
}

// Function to pick the delivery channel for the password reset otp
function pickPasswordResetChannel(user, useEmailIdentifier) {
  if (user.two_factor_enabled && user.two_factor_type === 'totp') return 'totp'; // if the two factor is enabled and the two factor type is totp, return totp
  if (user.two_factor_enabled && user.two_factor_type === 'email' && user.email) return 'email'; // if the two factor is enabled and the two factor type is email and the email is found, return email
  if (user.two_factor_enabled && user.two_factor_type === 'phone' && user.phone) return 'phone'; // if the two factor is enabled and the two factor type is phone and the phone is found, return phone
  return useEmailIdentifier ? 'email' : 'phone'; // otherwise, return the email or phone based on the use email identifier
}

// Function to deliver the password reset code
async function deliverPasswordResetCode(channel, user, otp) {
  if (channel === 'totp') return; // if the channel is totp, return
  let c = channel; // set the channel to the channel
  if (c === 'email' && !user.email) c = user.phone ? 'phone' : null; // if the channel is email and the email is not found, set the channel to phone
  if (c === 'phone' && !user.phone) c = user.email ? 'email' : null; // if the channel is phone and the phone is not found, set the channel to email
  if (c === 'email' && user.email) { // if the channel is email and the email is found
    await sendOtpEmail(user.email, otp); // send the otp to the email
    return; // return
  }
  console.warn(AUTH_LOG, 'Password reset: no delivery channel for user', user.id); // log the password reset no delivery channel for user
}

// Function to hash the device id
function hashDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return null; // if the device id is not found or the type is not a string, return null
  return crypto.createHash('sha256').update(deviceId.trim()).digest('hex'); // return the device id hashed
}

// Function to ping the auth service for diagnostics
router.get('/ping', (req, res) => {
  res.json({ ok: true, service: 'auth', ts: new Date().toISOString() }); // return the ok, service, and timestamp
});

// Function to normalize the phone for lookup
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null; // if the phone is not found or the type is not a string, return null
  const digits = phone.replace(/\D/g, ''); // replace all non-digits with an empty string
  return digits.length >= 10 ? digits : null; // return the digits if the length is greater than or equal to 10, otherwise return null
}

// Function to normalize the dob for lookup
function normalizeDob(dob) {
  if (!dob || typeof dob !== 'string') return dob; // if the dob is not found or the type is not a string, return the dob
  const trimmed = String(dob).trim(); // trim the dob
  const digits = trimmed.replace(/\D/g, ''); // replace all non-digits with an empty string
  // if the length of the digits is 8
  if (digits.length === 8) {
    const mm = digits.slice(0, 2); // get the month
    const dd = digits.slice(2, 4); // get the day
    const yyyy = digits.slice(4, 8); // get the year
    return `${yyyy}-${mm}-${dd}`; // return the dob in the format YYYY-MM-DD
  }
  return trimmed; // return the trimmed dob
}

// POST /api/auth/register
// Function to register a new user
router.post('/register', async (req, res, next) => {
  // Try to register a new user
  try {
    const { email, phone, password, two_factor_enabled, two_factor_type: reqTwoFactorType } = req.body; // get the email, phone, password, two factor enabled, and two factor type from the request body
    const useEmail = email != null && String(email).trim() !== ''; // if the email is not found or the email is not a string, return false
    const usePhone = !useEmail && phone != null && normalizePhone(phone); // if the phone is not found or the phone is not a string, return false
    // if the email and phone are not found, return an error
    if (!useEmail && !usePhone) {
      return res.status(400).json({ error: 'Email or phone is required' }); // return an error
    }
    // if the password is not found or the password is less than 8 characters, return an error
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' }); // return an error
    }
    const twoFactorEnabled = !!two_factor_enabled; // if the two factor enabled is not found, return false
    let twoFactorType = null; // set the two factor type to null
    // if the two factor enabled is true
    if (twoFactorEnabled) {
      const requested = reqTwoFactorType === 'totp' ? 'totp' : reqTwoFactorType === 'email' ? 'email' : reqTwoFactorType === 'phone' ? 'phone' : null; // get the requested two factor type
      // if the requested two factor type is totp
      if (requested === 'totp') {
        twoFactorType = 'totp'; // set the two factor type to totp
      } 
      // if the requested two factor type is email
      else if (requested === 'email') {
        if (!useEmail) return res.status(400).json({ error: 'Email 2FA requires signing up with email' }); // return an error
        twoFactorType = 'email'; // set the two factor type to email
      } 
      // if the requested two factor type is phone
      else if (requested === 'phone') {
        if (!usePhone) return res.status(400).json({ error: 'Phone 2FA requires signing up with phone' }); // return an error
        twoFactorType = 'phone'; // set the two factor type to phone
      } 
      // if the requested two factor type is not found, set the two factor type to the email or phone based on the use email identifier
      else {
        twoFactorType = useEmail ? 'email' : 'phone'; // set the two factor type to the email or phone based on the use email identifier
      }
    }

    // if the use email is true
    if (useEmail) {
      const existing = await db.findUserByEmail(email.trim()); // find the user by email
      if (existing) return res.status(409).json({ error: 'An account with this email already exists' }); // return an error
    } else {
      const normalized = normalizePhone(phone); // normalize the phone
      const existing = await db.findUserByPhone(normalized); // find the user by phone
      if (existing) return res.status(409).json({ error: 'An account with this phone number already exists' }); // return an error
    }

    const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS); // hash the password
    // set the insert data
    const insertData = {
      email: useEmail ? email.trim() : null, // email of the user
      phone: usePhone ? normalizePhone(phone) : null, // phone of the user
      password: hashedPassword, // hashed password
      role: 'customer', // role of the user
      status: 'active', // status of the user
      two_factor_enabled: twoFactorEnabled, // two factor enabled
      two_factor_type: twoFactorType, // two factor type
    };
    // if the two factor type is totp
    if (twoFactorType === 'totp') {
      const secret = generateSecret(); // generate the secret
      insertData.two_factor_secret = secret; // set the two factor secret
    }
    const row = await db.insertUser(insertData); // insert the user
    const user = db.rowToUser(row); // convert the row to a user
    const sessionToken = crypto.randomUUID(); // generate a random session token
    const deviceName = db.parseUserAgent(req.get('User-Agent')); // parse the user agent
    const ipAddress = db.getClientIp(req); // get the ip address
    const deviceFingerprint = hashDeviceId(req.body.deviceId) || null; // hash the device id
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS); // set the expires at to the current time plus the session expiry ms
    await db.createAuthSession(user.id, sessionToken, deviceName, deviceFingerprint, ipAddress, true, false, expiresAt); // create the auth session
    // if the two factor enabled is true
    if (twoFactorEnabled) {
      const tempToken = signTempToken({ userId: user.id }); //sign the temp token
      // if the two factor type is totp
      if (twoFactorType === 'totp') {
        const accountName = user.email || user.phone || `user-${user.id}`; // get the account name
        const totpSetup = { secret: insertData.two_factor_secret, qr_url: getOtpAuthUrl(insertData.two_factor_secret, accountName, 'EmmasEnvy') }; // get the totp setup
        return res.status(201).json({ requires2FA: true, tempToken, twoFactorType, user, totp_setup: totpSetup }); // return the requires 2fa response
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000)); // generate a random otp
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS); // set the otp expires at to the current time plus the otp expiry ms
      await db.setOtp(row.id, otp, otpExpiresAt); // set the otp
      console.log(AUTH_LOG, '2FA OTP (console only, not sent):', otp, '| channel:', twoFactorType); // log the 2fa otp
      return res.status(201).json({ requires2FA: true, tempToken, twoFactorType, user }); // return the requires 2fa response
    }

    const token = signToken({ userId: user.id, email: user.email, phone: user.phone, sessionId: sessionToken }); // sign the token
    res.status(201).json({ user, token }); // return the user and token
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/login
// Function to login a user
router.post('/login', async (req, res, next) => {
  // Try to login a user
  try {
    const { email, phone, password, staySignedIn, deviceId } = req.body; // get the email, phone, password, stay signed in, and device id from the request body
    const useEmail = email != null && String(email).trim() !== ''; // if the email is not found or the email is not a string, return false
    const usePhone = !useEmail && phone != null && normalizePhone(phone); // if the phone is not found or the phone is not a string, return false
    // if the email and phone are not found, return an error
    if (!useEmail && !usePhone) {
      return res.status(400).json({ error: 'Email or phone is required' }); // return an error
    }
    // if the password is not found, return an error
    if (!password) {
      return res.status(400).json({ error: 'Password is required' }); // return an error
    }

    const row = useEmail ? await db.findUserByEmail(email.trim()) : await db.findUserByPhone(normalizePhone(phone)); // find the user by email or phone
    if (!row) return res.status(401).json({ error: 'Invalid email/phone or password' }); // return an error
    if (row.status !== 'active') return res.status(401).json({ error: 'Account is deactivated' }); // return an error
    const match = await bcrypt.compare(String(password), row.password); // compare the password
    if (!match) return res.status(401).json({ error: 'Invalid email/phone or password' }); // return an error
    await db.updateLastLogin(row.id); // update the last login
    const user = db.rowToUser(row); // convert the row to a user
    const deviceIdHash = hashDeviceId(deviceId); // hash the device id
    const trustedSession = deviceIdHash ? await db.findTrustedSessionByUserAndFingerprint(row.id, deviceIdHash) : null; // find the trusted session by user and fingerprint
    const canSkip2FA = user.two_factor_enabled && !!trustedSession; // if the two factor enabled is true and the trusted session is found, return true
    // if the two factor enabled is true
    if (user.two_factor_enabled) {
      console.log(AUTH_LOG, 'Sign-in 2FA check', { userId: row.id, deviceIdHashPreview: deviceIdHash ? deviceIdHash.slice(0, 12) + '…' : null, hasTrustedSession: !!trustedSession, canSkip2FA }); // log the sign-in 2fa check
    }
    // if the two factor enabled is true and the can skip 2fa is false
    if (user.two_factor_enabled && !canSkip2FA) {
      // if the two factor type is totp
      if (user.two_factor_type === 'totp') { 
        const tempToken = signTempToken({ userId: user.id }); // sign the temp token
        return res.json({ requires2FA: true, tempToken, twoFactorType: 'totp' }); // return the requires 2fa response
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000)); // generate a random otp
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS); // set the expires at to the current time plus the otp expiry ms
      await db.setOtp(row.id, otp, expiresAt); // set the otp
      // if the two factor type is email and the email is found, send the otp to the email
      if (user.two_factor_type === 'email' && user.email) {
        await sendOtpEmail(user.email, otp); // send the otp to the email
      }
      // if the two factor type is phone, log the 2fa otp
      if (user.two_factor_type === 'phone') {
        console.log(AUTH_LOG, '2FA OTP (console only, not sent):', otp, '| channel: phone'); // log the 2fa otp
      }
      const tempToken = signTempToken({ userId: user.id }); // sign the temp token
      return res.json({ requires2FA: true, tempToken, twoFactorType: user.two_factor_type }); // return the requires 2fa response
    }

    const sessionToken = crypto.randomUUID(); // generate a random session token
    const deviceName = db.parseUserAgent(req.get('User-Agent')); // parse the user agent
    const ipAddress = db.getClientIp(req); // get the ip address
    const useLongSession = !!staySignedIn; // if the stay signed in is true, return true
    const sessionExpiryMs = useLongSession ? STAY_SIGNED_IN_EXPIRY_MS : SESSION_EXPIRY_MS; // set the session expiry ms
    const expiresAt = new Date(Date.now() + sessionExpiryMs); // set the expires at to the current time plus the session expiry ms
    await db.createAuthSession(user.id, sessionToken, deviceName, deviceIdHash || null, ipAddress, true, canSkip2FA, expiresAt); // create the auth session
    const token = signToken({ userId: user.id, email: user.email, phone: user.phone, sessionId: sessionToken }, useLongSession ? STAY_SIGNED_IN_JWT_EXPIRES_IN : undefined); // sign the token
    res.json({ user, token }); // return the user and token
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/forgot-password
// Function to request a password reset
router.post('/forgot-password', async (req, res, next) => {
  const started = Date.now(); // get the started time
  // Try to request a password reset
  try {
    const ip = db.getClientIp(req); // get the ip address
    const ipCheck = takeIpBucket(forgotIpBuckets, ip, FORGOT_IP_MAX, FORGOT_IP_WINDOW_MS); // take the ip bucket
    // if the ip check is not ok, return an error
    if (!ipCheck.ok) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.', // return an error
        retryAfterSec: ipCheck.retryAfterSec, // return the retry after seconds
      });
    }
    const { email, phone } = req.body; // get the email and phone from the request body
    const useEmail = email != null && String(email).trim() !== ''; // if the email is not found or the email is not a string, return false
    const usePhone = !useEmail && phone != null && normalizePhone(phone); // if the phone is not found or the phone is not a string, return false
    // if the email and phone are not found, return an error
    if (!useEmail && !usePhone) {
      return res.status(400).json({ error: 'Email or phone is required' }); // return an error
    }

    const normalizedId = useEmail ? normalizeEmailForLookup(email) : normalizePhone(phone); // normalize the email or phone
    const idThrottle = throttleIdentifier(normalizedId); // throttle the identifier
    // if the id throttle is not ok, return an error
    if (!idThrottle.ok) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.', // return an error
        retryAfterSec: idThrottle.retryAfterSec, // return the retry after seconds
      });
    }

    // find the user by email or phone
    const row = useEmail
      ? await db.findUserByEmail(normalizeEmailForLookup(email)) // find the user by email
      : await db.findUserByPhone(normalizePhone(phone)); // find the user by email or phone

    const minTotalMs = randomInt(280, 520); // generate a random number between 280 and 520
    // function to run the forgot password
    const runForgot = async () => {
      // if the row is not found or the status is not active, return
      if (!row || row.status !== 'active') {
        return; // return
      }
      const user = db.rowToUser(row); // convert the row to a user
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS); // set the expires at to the current time plus the otp expiry ms
      const channel = pickPasswordResetChannel(user, useEmail); // pick the password reset channel

      // if the channel is totp
      if (channel === 'totp') {
        await db.setOtp(row.id, RESET_TOTP_PENDING, expiresAt); // set the otp to the reset totp pending
        console.log(AUTH_LOG, 'Password reset: TOTP pending for user', row.id); // log the password reset totp pending
        return;
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000)); // generate a random otp
      await db.setOtp(row.id, otp, expiresAt); // set the otp
      await deliverPasswordResetCode(channel, user, otp); // deliver the password reset code
    };

    await runForgot(); // run the forgot password

    const elapsed = Date.now() - started; // get the elapsed time
    if (elapsed < minTotalMs) await sleep(minTotalMs - elapsed); // sleep for the remaining time

    res.json({ message: FORGOT_PASSWORD_GENERIC_MESSAGE }); // return the forgot password generic message
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/verify-forgot-code
// Function to verify a forgot password code
router.post('/verify-forgot-code', async (req, res, next) => {
  // Try to verify a forgot password code
  try {
    const ip = db.getClientIp(req); // get the ip address
    const ipCheck = takeIpBucket(resetIpBuckets, ip, RESET_IP_MAX, RESET_IP_WINDOW_MS); // take the ip bucket
    // if the ip check is not ok, return an error
    if (!ipCheck.ok) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.', // return an error
        retryAfterSec: ipCheck.retryAfterSec, // return the retry after seconds
      });
    }

    const { email, phone, code } = req.body; // get the email, phone, and code from the request body
    const useEmail = email != null && String(email).trim() !== ''; // if the email is not found or the email is not a string, return false
    const usePhone = !useEmail && phone != null && normalizePhone(phone); // if the phone is not found or the phone is not a string, return false
    // if the email and phone are not found, return an error
    if (!useEmail && !usePhone) {
      return res.status(400).json({ error: 'Email or phone is required' }); // return an error
    }

    const trimmedCode = String(code || '').replace(/\D/g, ''); // replace all non-digits with an empty string
    // if the length of the trimmed code is less than 6, return an error
    if (trimmedCode.length < 6) {
      return res.status(400).json({ error: 'Please enter at least 6 digits' }); // return an error
    }

    // find the user by email or phone
    const row = useEmail
      ? await db.findUserByEmail(normalizeEmailForLookup(email)) // find the user by email
      : await db.findUserByPhone(normalizePhone(phone)); // find the user by phone

    const genericFail = () => res.status(400).json({ error: 'Invalid or expired verification code.' }); // return an error

    // if the row is not found or the status is not active, return an error
    if (!row || row.status !== 'active') {
      return genericFail(); // return an error
    }
    // if the otp expires is not found, return an error
    if (!row.otp_expires) {
      return genericFail(); // return an error
    }
    const expiresAt = new Date(row.otp_expires); // set the expires at to the otp expires
    if (expiresAt < new Date()) { // if the expires at is less than the current date, clear the otp
      await db.clearOtp(row.id); // clear the otp
      return genericFail(); // return an error
    }

    const isTotpReset = row.otp === RESET_TOTP_PENDING; // if the otp is the reset totp pending, return true
    // if the otp is not the reset totp pending and the otp is not found, return an error
    if (!isTotpReset && !row.otp) {
      return genericFail(); // return an error
    }
    // if the otp is the reset totp pending
    if (isTotpReset) {
      // if the two factor enabled is not true or the two factor type is not totp or the two factor secret is not found, clear the otp and return an error
      if (!row.two_factor_enabled || row.two_factor_type !== 'totp' || !row.two_factor_secret) {
        await db.clearOtp(row.id); // clear the otp
        return genericFail(); // return an error
      }
      // if the totp code is not verified, return an error
      if (!verifyTotp(trimmedCode, row.two_factor_secret)) {
        return res.status(401).json({ error: 'Invalid or expired verification code.' }); // return an error
      }
    } 
    
    // if the otp is not the reset totp pending
    else {
      const stored = String(row.otp).replace(/\D/g, ''); // replace all non-digits with an empty string
      // if the stored otp is not 6 digits or the trimmed code is not the stored otp, return an error
      if (stored.length < 6 || trimmedCode !== stored) {
        return res.status(401).json({ error: 'Invalid or expired verification code.' }); // return an error
      }
    }

    await db.clearOtp(row.id); // clear the otp
    const resetToken = signPasswordResetToken(row.id); // sign the password reset token
    res.json({ resetToken }); // return the reset token
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/complete-forgot-password
router.post('/complete-forgot-password', async (req, res, next) => {
  // Try to complete a forgot password
  try {
    const ip = db.getClientIp(req); // get the ip address
    const ipCheck = takeIpBucket(resetIpBuckets, ip, RESET_IP_MAX, RESET_IP_WINDOW_MS); // take the ip bucket
    // if the ip check is not ok, return an error
    if (!ipCheck.ok) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.', // return an error
        retryAfterSec: ipCheck.retryAfterSec, // return the retry after seconds
      });
    }

    const { reset_token, resetToken, new_password, confirm_password } = req.body; // get the reset token, new password, and confirm password from the request body
    const token = (reset_token != null ? String(reset_token) : '') || (resetToken != null ? String(resetToken) : ''); // get the token from the request body
    // if the token is not found, return an error
    if (!token) {
      return res.status(400).json({ error: 'Reset session expired. Please start again.' }); // return an error
    }

    const decoded = verifyToken(token); // verify the token
    // if the decoded token is not found or the password reset is not true or the user id is not found, return an error
    if (!decoded || !decoded.passwordReset || !decoded.userId) {
      return res.status(401).json({ error: 'Reset session expired. Please start again.' }); // return an error
    }

    const newPass = new_password != null ? String(new_password) : ''; // get the new password from the request body
    // if the new password is less than 8 characters, return an error
    if (newPass.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' }); // return an error
    }
    // if the new password and confirm password do not match, return an error
    if (newPass !== (confirm_password != null ? String(confirm_password) : '')) {
      return res.status(400).json({ error: 'New password and confirmation do not match' }); // return an error
    }

    const row = await db.findUserById(decoded.userId); // find the user by id
    // if the row is not found or the status is not active, return an error
    if (!row || row.status !== 'active') {
      return res.status(401).json({ error: 'Reset session expired. Please start again.' }); // return an error
    }

    const hashed = await bcrypt.hash(newPass, SALT_ROUNDS); // hash the new password
    await db.updateProfile(row.id, { password: hashed }); // update the profile
    await db.clearOtp(row.id); // clear the otp
    await db.deleteAllSessionsForUser(row.id); // delete all sessions for the user

    res.json({ message: 'Your password has been updated. You can sign in with your new password.' }); // return the message
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/logout
// Function to logout
router.post('/logout', requireAuth, async (req, res, next) => {
  // Try to logout
  try {
    const sessionRowId = req.sessionRowId; // get the session row id
    // if the session row id is not null, delete the session by id
    if (sessionRowId != null) {
      await db.deleteSessionById(sessionRowId, req.user.id); // delete the session by id
    }
    res.json({ message: 'Signed out.' }); // return the message
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/verify-2fa
// Function to verify a 2fa code
router.post('/verify-2fa', async (req, res, next) => {
  // Try to verify a 2fa code
  try {
    const authHeader = req.headers.authorization; // get the authorization header
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null; // get the token from the authorization header
    // if the token is not found, return an error
    if (!token) {
      return res.status(401).json({ error: 'Token required' }); // return an error
    }
    const decoded = verifyToken(token); // verify the token
    // if the decoded token is not found or the temp2fa is not true, return an error
    if (!decoded || !decoded.temp2FA) {
      return res.status(401).json({ error: 'Invalid or expired verification token' }); // return an error
    }

    const { code, rememberDevice, deviceId } = req.body; // get the code, remember device, and device id from the request body
    const trimmed = String(code || '').replace(/\D/g, ''); // replace all non-digits with an empty string
    // if the length of the trimmed code is less than 6, return an error
    if (trimmed.length < 6) {
      return res.status(400).json({ error: 'Please enter at least 6 digits' }); // return an error
    }

    const deviceIdHash = hashDeviceId(deviceId); // hash the device id

    const row = await db.findUserById(decoded.userId); // find the user by id
    // if the row is not found or the status is not active, return an error
    if (!row || row.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' }); // return an error
    }
    // if the two factor type is totp and the two factor secret is found
    if (row.two_factor_type === 'totp' && row.two_factor_secret) {
      // if the totp code is not verified, return an error
      if (!verifyTotp(trimmed, row.two_factor_secret)) {
        return res.status(401).json({ error: 'Invalid code' }); // return an error
      }
    } 
    // else if the two factor type is not totp and the otp is not found or the otp expires is not found, return an error
    else {
      // if the otp is not found or the otp expires is not found, return an error
      if (!row.otp || !row.otp_expires) {
        return res.status(400).json({ error: 'No verification pending or code expired' }); // return an error
      }
      const expiresAt = new Date(row.otp_expires); // set the expires at to the otp expires
      // if the expires at is less than the current date, clear the otp and return an error
      if (expiresAt < new Date()) {
        await db.clearOtp(row.id); // clear the otp
        return res.status(400).json({ error: 'Code has expired. Please sign in again.' }); // return an error
      }
      // if the trimmed code is not the otp, return an error
      if (trimmed !== row.otp) {
        return res.status(401).json({ error: 'Invalid code' }); // return an error
      }
      await db.clearOtp(row.id); // clear the otp
    }
    const user = db.rowToUser(row); // convert the row to a user

    const sessionToken = crypto.randomUUID(); // generate a random session token
    const deviceName = db.parseUserAgent(req.get('User-Agent')); // parse the user agent
    const ipAddress = db.getClientIp(req); // get the ip address
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS); // set the expires at to the current time plus the session expiry ms
    await db.createAuthSession(user.id, sessionToken, deviceName, deviceIdHash || null, ipAddress, true, !!rememberDevice, expiresAt); // create the auth session
    const fullToken = signToken({ userId: user.id, email: user.email, phone: user.phone, sessionId: sessionToken }); // sign the token
    res.json({ user, token: fullToken }); // return the user and token
  } catch (err) {
    next(err); // next the error
  }
});

// GET /api/auth/me 
// Function to get the current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user }); // return the user
});

// GET /api/auth/sessions
// Function to get the active sessions for the logged-in user
router.get('/sessions', requireAuth, async (req, res, next) => {
  // Try to get the active sessions for the logged-in user
  try {
    const sessions = await db.getAuthSessionsForUser(req.user.id, req.sessionId || null); // get the active sessions for the logged-in user
    res.json({ sessions }); // return the sessions
  } catch (err) {
    next(err); // next the error
  }
});

// DELETE /api/auth/sessions/:id
// Function to revoke a specific device
router.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  // Try to revoke a specific device
  try {
    const id = parseInt(req.params.id, 10); // get the id from the request params
    // if the id is not a number, return an error
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session id' }); // return an error
    }
    const deleted = await db.deleteSessionById(id, req.user.id); // delete the session by id
    // if the session is not deleted, return an error
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' }); // return an error
    }
    res.json({ message: 'Session revoked.' }); // return the message
  } catch (err) {
    next(err); // next the error
  }
});

// PATCH /api/auth/sessions/:id/untrust
// Function to untrust a specific device
router.patch('/sessions/:id/untrust', requireAuth, async (req, res, next) => {
  // Try to untrust a specific device
  try {
    const id = parseInt(req.params.id, 10); // get the id from the request params
    // if the id is not a number, return an error
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session id' }); // return an error
    }
    const updated = await db.updateSessionTrusted(id, req.user.id, false); // update the session trusted
    // if the session is not updated, return an error
    if (!updated) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ message: 'Device untrusted. Two-factor will be required on next login.' }); // return the message
  } catch (err) {
    next(err); // next the error
  }
});

// PATCH /api/auth/me/2fa
// Function to enable/disable 2FA and set type
router.patch('/me/2fa', requireAuth, async (req, res, next) => {
  // Try to enable/disable 2FA and set type
  try {
    const { two_factor_enabled, two_factor_type, current_password } = req.body; // get the two factor enabled, two factor type, and current password from the request body
    const data = {}; // set the data to an empty object
    if (two_factor_enabled !== undefined) data.two_factor_enabled = !!two_factor_enabled; // set the two factor enabled to the two factor enabled
    let twoFactorType = null; // let the two factor type be null
    // if the two factor type is not undefined
    if (two_factor_type !== undefined) {
      twoFactorType = two_factor_type === 'phone' || two_factor_type === 'sms' ? 'phone' : two_factor_type === 'email' ? 'email' : two_factor_type === 'totp' ? 'totp' : null; // set the two factor type to the two factor type
      data.two_factor_type = twoFactorType; // set the two factor type to the two factor type
    }
    // if the data is empty, return the user
    if (Object.keys(data).length === 0) {
      const row = await db.findUserById(req.user.id); // find the user by id
      return res.json({ user: db.rowToUser(row) }); // return the user
    }

    const isDisabling = data.two_factor_enabled === false; // set the is disabling to the two factor enabled
    const isChangingType = twoFactorType != null && req.user.two_factor_enabled; // set the is changing type to the two factor type
    // if the is disabling or the is changing type is true
    if (isDisabling || isChangingType) {
      // if the current password is not found or the current password is not a string, return an error
      if (!current_password || String(current_password).trim() === '') {
        return res.status(400).json({ error: 'Enter your current password to continue.' }); // return an error
      }
      const row = await db.findUserById(req.user.id); // find the user by id
      // if the row is not found or the password is not found, return an error
      if (!row || !row.password) {
        return res.status(400).json({ error: 'Password verification is not available for this account.' }); // return an error
      }
      const passwordMatch = await bcrypt.compare(String(current_password).trim(), row.password); // compare the current password to the password
      // if the password match is not true, return an error
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect.' }); // return an error
      }
    }

    // Require email/phone on account when setting 2FA type to email/phone
    if (twoFactorType === 'email' && data.two_factor_enabled !== false) {
      // if the email is not found or the email is not a string, return an error
      if (!req.user.email || String(req.user.email).trim() === '') {
        return res.status(400).json({ error: 'Add an email to your account first to use email for 2FA codes.' }); // return an error
      }
    }
    // if the two factor type is phone and the two factor enabled is not false
    if (twoFactorType === 'phone' && data.two_factor_enabled !== false) {
      // if the phone is not found or the phone is not a string, return an error
      if (!req.user.phone || String(req.user.phone).trim() === '') {
        return res.status(400).json({ error: 'Add a phone number to your account first to use phone for 2FA codes.' }); // return an error
      }
    }
    let totpSetup = null; // let the totp setup be null
    // if the two factor type is totp and the two factor enabled is not false
    if (twoFactorType === 'totp' && data.two_factor_enabled !== false) {
      const secret = generateSecret(); // generate the secret
      data.two_factor_secret = secret; // set the two factor secret to the secret
      const accountName = req.user.email || req.user.phone || `user-${req.user.id}`; // set the account name to the email or phone or user id
      totpSetup = { secret, qr_url: getOtpAuthUrl(secret, accountName, 'EmmasEnvy') }; // set the totp setup to the secret and qr url
    }
    await db.updateUser2FA(req.user.id, data); // update the user 2fa
    const row = await db.findUserById(req.user.id); // find the user by id
    const payload = { user: db.rowToUser(row) }; // set the payload to the user
    if (totpSetup) payload.totp_setup = totpSetup; // set the totp setup to the payload
    res.json(payload); // return the payload
  } catch (err) {
    next(err); // next the error
  }
});

  // PATCH /api/auth/me
  // Function to update the profile of the user
router.patch('/me', requireAuth, async (req, res, next) => {
  //Try to update the profile of the user
  try {
    const { first_name, last_name, dob } = req.body; // get the first name, last name, and date of birth from the request body
    const data = {}; // set the data to an empty object
    if (first_name !== undefined) data.first_name = String(first_name).trim(); // set the first name to the first name
    if (last_name !== undefined) data.last_name = String(last_name).trim(); // set the last name to the last name
    if (dob !== undefined) data.dob = dob != null ? String(dob).trim() : null; // set the date of birth to the date of birth
    // if the data is empty, return the user
    if (Object.keys(data).length === 0) {
      const row = await db.findUserById(req.user.id); // find the user by id
      return res.json({ user: db.rowToUser(row) }); // return the user
    }
    await db.updateProfile(req.user.id, data); // update the profile
    const row = await db.findUserById(req.user.id); // find the user by id
    res.json({ user: db.rowToUser(row) }); // return the user
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/profile-photo 
// Function to upload a profile photo
router.post('/profile-photo', requireAuth, profilePhotoUpload.single('photo'), async (req, res, next) => {
  // Try to upload a profile photo
  try {
    // if the file is not found, return an error
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' }); // return an error
    }
    const relativePath = path.join('profile_photos', req.file.filename).split(path.sep).join('/'); // join the path to the profile photos and the file name
    const previous = req.user.profile_picture; // get the previous profile picture from the user
    // if the previous profile picture starts with the profile photos, delete the old path
    if (previous && previous.startsWith('profile_photos/')) {
      const oldPath = path.join(__dirname, '..', 'uploads', previous); // join the path to the uploads and the previous path
      // try to delete the old path
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); // delete the old path
      } catch (_) {}
    }
    await db.updateProfile(req.user.id, { profile_picture: relativePath }); // update the profile
    const row = await db.findUserById(req.user.id); // find the user by id
    const user = db.rowToUser(row); // convert the row to a user
    res.json({ user }); // return the user
  } catch (err) {
    next(err); // next the error
  }
});

// PATCH /api/auth/account
// Function to update the account of the user
router.patch('/account', requireAuth, async (req, res, next) => {
  // Try to update the account of the user
  try {
    const { current_password, email, phone, new_password, confirm_password } = req.body; // get the current password, email, phone, new password, and confirm password from the request body
    const wantEmail = email !== undefined && String(email).trim() !== ''; // set the want email to the email
    const wantPhone = phone !== undefined; // set the want phone to the phone
    const wantPassword = new_password !== undefined && String(new_password).length > 0; // set the want password to the new password
    // if the want email, want phone, and want password are not true, return the user
    if (!wantEmail && !wantPhone && !wantPassword) {
      const row = await db.findUserById(req.user.id); // find the user by id
      return res.json({ user: db.rowToUser(row) }); // return the user
    }

    const row = await db.findUserById(req.user.id); // find the user by id
    // if the row is not found or the password is not found, return an error
    if (!row || !row.password) {
      return res.status(400).json({ error: 'Current password is required to change email, phone, or password.' }); // return an error
    }
    // if the current password is not found or the current password is not a string, return an error
    if (!current_password || String(current_password).length === 0) {
      return res.status(400).json({ error: 'Current password is required to change email, phone, or password.' }); // return an error
    }
    const passwordMatch = await bcrypt.compare(String(current_password), row.password); // compare the current password to the password
    // if the password match is not true, return an error
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' }); // return an error
    }

    const data = {}; // set the data to an empty object
    // if the want email is true
    if (wantEmail) {
      const newEmail = String(email).trim(); // set the new email to the email
      // if the new email is not the email, return an error
      if (newEmail !== (row.email || '')) {
        const existing = await db.findUserByEmail(newEmail); // find the user by email
        // if the existing user is found and the existing user id is not the user id, return an error
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'An account with this email already exists.' }); // return an error
        }
        data.email = newEmail; // set the email to the new email
      }
    }
    // if the want phone is true
    if (wantPhone) {
      const normalized = normalizePhone(String(phone || '')); // normalize the phone
      const newPhone = normalized || (phone != null && String(phone).trim() !== '' ? String(phone).trim() : null); // set the new phone to the normalized phone or the phone if the phone is not null and the phone is not a string
      // if the new phone is not the phone, return an error
      if (newPhone !== (row.phone || '')) {
        // if the normalized is found and the normalized length is greater than or equal to 10, return an error
        if (normalized && normalized.length >= 10) {
          const existing = await db.findUserByPhone(normalized); // find the user by phone
          // if the existing user is found and the existing user id is not the user id, return an error
          if (existing && existing.id !== req.user.id) {
            return res.status(409).json({ error: 'An account with this phone number already exists.' }); // return an error
          }
        }
        data.phone = normalized || newPhone || null; // set the phone to the normalized phone or the new phone or null
      }
    }
    // if the want password is true
    if (wantPassword) {
      const newPass = String(new_password); // set the new password to the new password
      // if the new password is less than 8 characters, return an error
      if (newPass.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' }); // return an error
      }
      // if the new password is not the confirm password, return an error
      if (newPass !== (confirm_password != null ? String(confirm_password) : '')) {
        return res.status(400).json({ error: 'New password and confirmation do not match.' }); // return an error
      }
      data.password = await bcrypt.hash(newPass, SALT_ROUNDS); // set the password to the new password
    }
    // if the data is not empty, update the profile
    if (Object.keys(data).length > 0) {
      await db.updateProfile(req.user.id, data); // update the profile
    }
    const updated = await db.findUserById(req.user.id); // find the user by id
    res.json({ user: db.rowToUser(updated) }); // return the user
  } catch (err) {
    next(err); // next the error
  }
});

// POST /api/auth/complete-profile 
// Function to complete the profile of the user
router.post('/complete-profile', requireAuthOrTemp2FA, async (req, res, next) => {
  // Try to complete the profile of the user
  try {
    const { first_name, last_name, dob, phone, email, profile_picture } = req.body; // get the first name, last name, date of birth, phone, email, and profile picture from the request body
    // if the first name is not found or the first name is not a string, return an error
    if (!first_name || String(first_name).trim() === '') {
      return res.status(400).json({ error: 'First name is required' }); // return an error
    }
    //If the date of birth is not found or the date of birth is not a string, return an error
    if (!dob || String(dob).trim() === '') {
      return res.status(400).json({ error: 'Date of birth is required' }); // return an error
    }
    // set the data to the first name and date of birth
    const data = {
      first_name: String(first_name).trim(), // set the first name to the first name
      dob: normalizeDob(dob), // set the date of birth to the date of birth
    };
    if (last_name !== undefined) data.last_name = String(last_name).trim(); // set the last name to the last name
    // if the phone is not found or the phone is not a string, return an error
    if (phone != null && String(phone).trim() !== '') {
      const normalized = normalizePhone(String(phone)); // normalize the phone
      data.phone = normalized || String(phone).trim(); // set the phone to the normalized phone or the phone
    }
    // if the email is not found or the email is not a string, return an error
    if (email != null && String(email).trim() !== '') {
      data.email = String(email).trim(); // set the email to the email
    }
    // if the profile picture is not found or the profile picture is not a string, return an error
    if (profile_picture != null && String(profile_picture).trim() !== '') {
      data.profile_picture = String(profile_picture).trim(); // set the profile picture to the profile picture
    }
    // if the email is not found, return an error
    if (data.email) {
      const existing = await db.findUserByEmail(data.email); // find the user by email
      // if the existing user is found and the existing user id is not the user id, return an error
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'An account with this email already exists.' }); // return an error
      }
    }
    // if the phone is not found, return an error
    if (data.phone) {
      const normalized = normalizePhone(data.phone); // normalize the phone
      // if the normalized is found and the normalized length is greater than or equal to 10, return an error
      if (normalized && normalized.length >= 10) {
        const existing = await db.findUserByPhone(normalized); // find the user by phone
        // if the existing user is found and the existing user id is not the user id, return an error
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'An account with this phone number already exists.' }); // return an error
        }
        data.phone = normalized; // set the phone to the normalized phone
      }
    }
    await db.updateProfile(req.user.id, data); // update the profile
    const row = await db.findUserById(req.user.id); // find the user by id
    const user = db.rowToUser(row); // convert the row to a user
    // if the request is a temp 2fa, sign the token with the user id, email, and phone
    const token = req.isTemp2FA
      ? signToken({ userId: user.id, email: user.email, phone: user.phone }) // sign the token with the user id, email, and phone
      : undefined; // if the request is not a temp 2fa, return undefined
    // if the token is found, return the user and token
    if (token) {
      return res.json({ user, token }); // return the user and token
    }
    res.json({ user }); // return the user
  } catch (err) {
    next(err); // next the error
  }
});

module.exports = router; // export the router
