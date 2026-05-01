//simple in-memory rate limiter for guest support endpoints per IP

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_WINDOW = 30; // 30 requests per minute

const buckets = new Map(); // create a new map for the buckets

//function to prune the buckets
function prune() {
  const now = Date.now(); // get the current time
  // for each key and record in the buckets, if the current time minus the start time is greater than 2 minutes, delete the key
  for (const [key, rec] of buckets.entries()) {
    if (now - rec.start > WINDOW_MS * 2) buckets.delete(key); // delete the key if the current time minus the start time is greater than 2 minutes
  }
}

//function to rate limit the guest support endpoints
function rateLimitGuestSupport(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'; // get the ip address
  const key = `support-guest:${ip}`; // create a key for the ip address
  const now = Date.now(); // get the current time
  prune(); // prune the buckets
  let rec = buckets.get(key); // get the record for the ip address
  // if the record is not found or the current time minus the start time is greater than 1 minute, create a new record
  if (!rec || now - rec.start > WINDOW_MS) {
    rec = { start: now, count: 0 }; // create a new record
    buckets.set(key, rec); // set the record to the key
  }
  rec.count += 1; // increment the count
  // if the count is greater than 30, return an error
  if (rec.count > MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' }); // return an error
  }
  next(); // next the request
}

module.exports = { rateLimitGuestSupport };
