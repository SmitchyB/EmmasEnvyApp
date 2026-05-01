const jwt = require('jsonwebtoken');
const {
  JWT_EXPIRES_IN,
  TEMP_TOKEN_EXPIRES_IN,
  PASSWORD_RESET_TOKEN_EXPIRES_IN,
  GUEST_TICKET_JWT_EXPIRES_IN,
} = require('./constants');

const JWT_SECRET = process.env.JWT_SECRET;

/** Audience claim for support-ticket guest tokens (distinct from user session JWTs). */
const GUEST_TICKET_JWT_AUDIENCE = 'emmasenvy_guest_ticket';

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

function signGuestTicketToken(ticketId) {
  return jwt.sign({ ticketId: Number(ticketId) }, JWT_SECRET, {
    expiresIn: GUEST_TICKET_JWT_EXPIRES_IN,
    audience: GUEST_TICKET_JWT_AUDIENCE,
  });
}

/** @returns {{ ticketId: number } | null} */
function verifyGuestTicketToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { audience: GUEST_TICKET_JWT_AUDIENCE });
    const ticketId = decoded.ticketId;
    if (ticketId == null || Number.isNaN(Number(ticketId))) return null;
    return { ticketId: Number(ticketId) };
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  signTempToken,
  signPasswordResetToken,
  verifyToken,
  signGuestTicketToken,
  verifyGuestTicketToken,
  JWT_EXPIRES_IN,
  GUEST_TICKET_JWT_AUDIENCE,
};
