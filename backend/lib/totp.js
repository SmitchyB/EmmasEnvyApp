/**
 * Minimal TOTP (RFC 6238): generate secret and verify 6-digit code.
 * Uses HMAC-SHA1; 30-second window; optional ±1 period for clock skew.
 * Base32 (RFC 4648) implemented manually – Node Buffer has no 'base32' encoding.
 */

const crypto = require('crypto');

const PERIOD = 30;
const DIGITS = 6;
const WINDOW = 1; // allow previous/next period

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += B32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) result += B32_ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function base32Decode(str) {
  const clean = str.toUpperCase().replace(/\s/g, '').replace(/=+$/, '');
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function generateSecret(length = 20) {
  return base32Encode(crypto.randomBytes(length));
}

function getCounter(timeMs) {
  return Math.floor(timeMs / 1000 / PERIOD);
}

function truncate(buffer) {
  const offset = buffer[buffer.length - 1] & 0x0f;
  const p = (buffer[offset] & 0x7f) << 24 |
    (buffer[offset + 1] & 0xff) << 16 |
    (buffer[offset + 2] & 0xff) << 8 |
    (buffer[offset + 3] & 0xff);
  return p % Math.pow(10, DIGITS);
}

function getToken(secret, counter) {
  const decoded = base32Decode(secret);
  const counterBuf = Buffer.allocUnsafe(8);
  counterBuf.writeBigInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', decoded);
  hmac.update(counterBuf);
  const hash = hmac.digest();
  const code = truncate(hash);
  return String(code).padStart(DIGITS, '0');
}

/**
 * Verify a 6-digit code against the secret. Allows ±WINDOW periods.
 * @param {string} code - User-entered code (6 digits)
 * @param {string} secret - Base32 TOTP secret
 * @returns {boolean}
 */
function verify(code, secret) {
  if (!secret || !code || typeof code !== 'string') return false;
  const trimmed = code.replace(/\D/g, '');
  if (trimmed.length !== DIGITS) return false;
  const now = Date.now();
  const baseCounter = getCounter(now);
  for (let i = -WINDOW; i <= WINDOW; i++) {
    const expected = getToken(secret, baseCounter + i);
    if (trimmed === expected) return true;
  }
  return false;
}

/**
 * Build otpauth URL for QR code (e.g. for Google Authenticator).
 * @param {string} secret - Base32 secret
 * @param {string} accountName - e.g. user email or "EmmasEnvy"
 * @param {string} issuer - e.g. "EmmasEnvy"
 */
function getOtpAuthUrl(secret, accountName = 'user', issuer = 'EmmasEnvy') {
  const encoded = encodeURIComponent(issuer + ':' + accountName);
  return `otpauth://totp/${encoded}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=${PERIOD}&digits=${DIGITS}`;
}

module.exports = { generateSecret, verify, getOtpAuthUrl };
