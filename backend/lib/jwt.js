const jwt = require('jsonwebtoken');
const {
  JWT_EXPIRES_IN,
  TEMP_TOKEN_EXPIRES_IN,
  PASSWORD_RESET_TOKEN_EXPIRES_IN,
} = require('./constants');

const JWT_SECRET = process.env.JWT_SECRET;

function signToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function signTempToken(payload) {
  return jwt.sign({ ...payload, temp2FA: true }, JWT_SECRET, {
    expiresIn: TEMP_TOKEN_EXPIRES_IN,
  });
}

/** One-time step between verifying reset code and choosing a new password. */
function signPasswordResetToken(userId) {
  return jwt.sign({ userId, passwordReset: true }, JWT_SECRET, {
    expiresIn: PASSWORD_RESET_TOKEN_EXPIRES_IN,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  signTempToken,
  signPasswordResetToken,
  verifyToken,
  JWT_EXPIRES_IN,
};
