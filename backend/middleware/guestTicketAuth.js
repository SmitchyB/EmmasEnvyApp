//middleware to require a guest ticket auth token to access a support ticket for guest customers

const { verifyGuestTicketToken } = require('../lib/jwt'); // verify the guest ticket token

//function to require a guest ticket auth token to access a support ticket for guest customers
function requireGuestTicketAuth(req, res, next) {
  const authHeader = req.headers.authorization; // get the authorization header
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null; // get the token from the authorization header
  // if the token is not found, return an error
  if (!token) {
    return res.status(401).json({ error: 'Guest ticket token required' }); // return an error
  }
  const decoded = verifyGuestTicketToken(token); // verify the guest ticket token
  // if the decoded token is not found, return an error
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired guest ticket token' }); // return an error
  }
  req.guestTicketId = decoded.ticketId; // set the guest ticket id to the decoded ticket id
  next();
}

module.exports = { requireGuestTicketAuth };
 