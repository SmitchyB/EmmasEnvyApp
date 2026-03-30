const { verifyToken } = require('../lib/jwt');
const db = require('../lib/db');

const AUTH_LOG = '[Auth]';

/**
 * Require a valid JWT. Attach req.user (safe user object). Reject temp2FA tokens.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      console.log(AUTH_LOG, 'requireAuth: 401 no token');
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = verifyToken(token);
    if (!decoded || decoded.temp2FA) {
      console.log(AUTH_LOG, 'requireAuth: 401 invalid or expired token', {
        hasDecoded: !!decoded,
        temp2FA: decoded?.temp2FA,
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const [row, sessionRow] = await Promise.all([
      db.findUserById(decoded.userId),
      decoded.sessionId ? db.findSessionByToken(decoded.userId, decoded.sessionId) : null,
    ]);
    if (!row || row.status !== 'active') {
      console.log(AUTH_LOG, 'requireAuth: 401 user not found or inactive', {
        userId: decoded.userId,
        hasRow: !!row,
        status: row?.status,
      });
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    if (decoded.sessionId && !sessionRow) {
      console.log(AUTH_LOG, 'requireAuth: 401 session not found or expired');
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
    req.user = db.rowToUser(row);
    req.sessionId = decoded.sessionId || null;
    req.sessionRowId = sessionRow ? sessionRow.id : null;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Accept either full JWT or temp 2FA token. Attach req.user and req.isTemp2FA.
 */
async function requireAuthOrTemp2FA(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const isTemp2FA = !!decoded.temp2FA;
    const row = await db.findUserById(decoded.userId);
    if (!row || row.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = db.rowToUser(row);
    req.isTemp2FA = isTemp2FA;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth: if Bearer token present and valid, set req.user; otherwise set req.user = null (no 401).
 * Use for public endpoints that behave differently when logged in (e.g. checkout).
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      req.user = null;
      return next();
    }
    const decoded = verifyToken(token);
    if (!decoded || decoded.temp2FA) {
      req.user = null;
      return next();
    }
    const row = await db.findUserById(decoded.userId);
    if (!row || row.status !== 'active') {
      req.user = null;
      return next();
    }
    req.user = db.rowToUser(row);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require auth and admin role. Use after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'admin') {
    return next();
  }
  console.log(AUTH_LOG, 'requireAdmin: 403 not admin', { userId: req.user?.id, role: req.user?.role });
  return res.status(403).json({ error: 'Admin access required' });
}

/**
 * Require auth and Admin or IT role. Use after requireAuth.
 */
function requireAdminOrIT(req, res, next) {
  const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';
  if (role === 'admin' || role === 'it') {
    return next();
  }
  console.log(AUTH_LOG, 'requireAdminOrIT: 403', { userId: req.user?.id, role: req.user?.role });
  return res.status(403).json({ error: 'Admin or IT access required' });
}

module.exports = { requireAuth, requireAuthOrTemp2FA, requireAdmin, requireAdminOrIT, optionalAuth };
