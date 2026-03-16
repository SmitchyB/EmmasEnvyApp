/**
 * Shared constants – single place to change time, sizes, auth, and business values.
 */

// --- Time / expiry ---
/** Auth session lifetime (7 days). */
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** When "stay signed in" is checked: session lifetime (30 days). */
const STAY_SIGNED_IN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/** Email/SMS OTP validity (10 minutes). */
const OTP_EXPIRY_MS = 10 * 60 * 1000;

/** Main JWT expiry string for jsonwebtoken. */
const JWT_EXPIRES_IN = '7d';

/** When "stay signed in" is checked: JWT expiry string. */
const STAY_SIGNED_IN_JWT_EXPIRES_IN = '30d';

/** 2FA temp token expiry string. */
const TEMP_TOKEN_EXPIRES_IN = '10m';

// --- Upload / file sizes ---
/** Max size for profile photo uploads (2 MB). */
const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;

/** Max size for general image uploads (5 MB). */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// --- Auth ---
/** Bcrypt salt rounds. */
const SALT_ROUNDS = 10;

// --- Business / app ---
const DEFAULT_CURRENCY = 'USD';
const SHIPPING_COST = 15;
const POINTS_PER_DOLLAR = 1;

module.exports = {
  SESSION_EXPIRY_MS,
  STAY_SIGNED_IN_EXPIRY_MS,
  OTP_EXPIRY_MS,
  JWT_EXPIRES_IN,
  STAY_SIGNED_IN_JWT_EXPIRES_IN,
  TEMP_TOKEN_EXPIRES_IN,
  MAX_PROFILE_PHOTO_SIZE,
  MAX_IMAGE_SIZE,
  SALT_ROUNDS,
  DEFAULT_CURRENCY,
  SHIPPING_COST,
  POINTS_PER_DOLLAR,
};
