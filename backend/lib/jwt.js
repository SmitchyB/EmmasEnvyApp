const jwt = require('jsonwebtoken');
const { JWT_EXPIRES_IN, TEMP_TOKEN_EXPIRES_IN } = require('./constants');

const JWT_SECRET = process.env.JWT_SECRET;

function signToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function signTempToken(payload) {
  return jwt.sign({ ...payload, temp2FA: true }, JWT_SECRET, {
    expiresIn: TEMP_TOKEN_EXPIRES_IN,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { signToken, signTempToken, verifyToken, JWT_EXPIRES_IN };
