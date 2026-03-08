require('dotenv').config();
// If the JWT_SECRET is not set or is less than 16 characters, exit the process
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET must be set and at least 16 characters');
  process.exit(1);
}
const fs = require('fs'); // Import the fs module for file system operations
const path = require('path'); // Import the path module for file system operations
const express = require('express'); // Import the express module for the web server
const cors = require('cors'); // Import the cors module for the web server
const authRoutes = require('./routes/auth'); // Import the auth routes
const productRoutes = require('./routes/products'); // Import the product routes
const portfolioRoutes = require('./routes/portfolios'); // Import the portfolio routes
const serviceTypesRoutes = require('./routes/serviceTypes'); // Import the service types routes
const appointmentsRoutes = require('./routes/appointments'); // Import the appointments routes
const ordersRoutes = require('./routes/orders'); // Import the orders routes
const supportTicketsRoutes = require('./routes/supportTickets'); // Import the support tickets routes
const promoCodesRoutes = require('./routes/promoCodes'); // Import the promo codes routes
const rewardOfferingsRoutes = require('./routes/rewardOfferings'); // Import the reward offerings routes
const newslettersRoutes = require('./routes/newsletters'); // Import the newsletters routes
const posRoutes = require('./routes/pos'); // Import the pos routes
const meInvoicesRoutes = require('./routes/meInvoices'); // Import the me invoices routes
const meSupportTicketsRoutes = require('./routes/meSupportTickets'); // Import the me support tickets routes
const meAddressesRoutes = require('./routes/meAddresses'); // Import the me addresses routes
const meNotificationPreferencesRoutes = require('./routes/meNotificationPreferences'); // Import the me notification preferences routes
const meDataPrivacyRoutes = require('./routes/meDataPrivacy'); // Import the me data privacy routes
const siteSettingsRoutes = require('./routes/siteSettings'); // Import the site settings routes
const cartRoutes = require('./routes/cart'); // Import the cart routes
const checkoutRoutes = require('./routes/checkout'); // Import the checkout routes
const UPLOADS_DIR = path.join(__dirname, 'uploads'); // Define the uploads directory
const PROFILE_PHOTOS_DIR = path.join(UPLOADS_DIR, 'profile_photos');
const PORTFOLIO_PHOTOS_DIR = path.join(UPLOADS_DIR, 'portfolio'); // Define the portfolio photos directory
const PRODUCTS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'products'); // Define the products upload directory
const SUPPORT_UPLOAD_DIR = path.join(UPLOADS_DIR, 'support'); // Define the support upload directory
fs.mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true }); // Create the profile photos directory
fs.mkdirSync(PORTFOLIO_PHOTOS_DIR, { recursive: true }); // Create the portfolio photos directory
fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true }); // Create the products upload directory
fs.mkdirSync(SUPPORT_UPLOAD_DIR, { recursive: true }); // Create the support upload directory
const app = express(); // Create the express application
const PORT = process.env.PORT || 3002; // Define the port
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:4321'; // Define the client URL
const AUTH_LOG = '[Auth]'; // Define the auth log
const REQ_LOG = '[Request]'; // Define the request log

// Log EVERY incoming request – first middleware so we see if traffic reaches the server
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  const clientIp = req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  console.log(REQ_LOG, ts, 'IN', req.method, req.originalUrl, '| client:', clientIp, '| host:', req.headers.host || '-');
  next();
});

app.use(cors({ origin: CLIENT_URL, credentials: true })); // Use the cors middleware to allow requests from the client URL  
app.use(express.json()); // Use the express.json middleware to parse the request body

// Request logging – after body parse so we can see POST body
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') { 
    const ts = new Date().toISOString();
    const authHeader = req.headers.authorization;
    const hasAuth = !!(authHeader && authHeader.startsWith('Bearer '));
    const log = {
      ts,
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      host: req.headers.host,
      contentType: req.headers['content-type'] || '(none)',
      hasAuthToken: hasAuth,
      authTokenLength: hasAuth ? Math.max(0, (authHeader.length || 0) - 7) : 0, // "Bearer " = 7
    };
    if ((req.method === 'POST' || req.method === 'PATCH') && req.body && typeof req.body === 'object') {
      log.bodyKeys = Object.keys(req.body);
      log.bodySize = JSON.stringify(req.body).length;
    }
    console.log(AUTH_LOG, '>>> Incoming request', log);
  }
  next();
});

// Prevent browsers from caching API responses (avoids stale HTML 404 for GET when backend was not on :3000)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});

// Response logging for /api – log what we send back (status, content-type, body summary)
app.use('/api', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (process.env.NODE_ENV !== 'production') {
      const contentType = res.get('Content-Type');
      console.log(AUTH_LOG, '<<< Response (res.json)', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        contentType: contentType || 'application/json',
        bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        bodyPreview:
          body && typeof body === 'object'
            ? JSON.stringify(body).slice(0, 120) + (JSON.stringify(body).length > 120 ? '…' : '')
            : String(body).slice(0, 80),
      });
    }
    return originalJson(body);
  };
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'production') {
      const contentType = res.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        console.log(AUTH_LOG, '<<< Response (finish, non-JSON)', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          contentType,
        });
      }
    }
  });
  next();
});

app.use('/api/auth', authRoutes); // Mount the auth routes
app.use('/api/products', productRoutes); // Mount the product routes
app.use('/api/portfolios', portfolioRoutes); // Mount the portfolio routes
app.use('/api/service-types', serviceTypesRoutes); // Mount the service types routes
app.use('/api/appointments', appointmentsRoutes); // Mount the appointments routes
app.use('/api/orders', ordersRoutes); // Mount the orders routes
app.use('/api/support-tickets', supportTicketsRoutes); // Mount the support tickets routes
app.use('/api/promo-codes', promoCodesRoutes); // Mount the promo codes routes
app.use('/api/reward-offerings', rewardOfferingsRoutes); // Mount the reward offerings routes
app.use('/api/newsletters', newslettersRoutes); // Mount the newsletters routes
app.use('/api/pos', posRoutes); // Mount the pos routes
app.use('/api/me', meInvoicesRoutes); // Mount the me invoices routes
app.use('/api/me', meSupportTicketsRoutes); // Mount the me support tickets routes
app.use('/api/me', meAddressesRoutes); // Mount the me addresses routes
app.use('/api/me', meNotificationPreferencesRoutes); // Mount the me notification preferences routes
app.use('/api/me', meDataPrivacyRoutes); // Mount the me data privacy routes
app.use('/api/site-settings', siteSettingsRoutes); // Mount the site settings routes
app.use('/api/cart', cartRoutes); // Mount the cart routes
app.use('/api/checkout', checkoutRoutes); // Mount the checkout routes
app.use('/uploads', express.static(UPLOADS_DIR)); // Mount the uploads directory

// 404 handler – if user gets here, no route matched (log and return JSON)
app.use((req, res, next) => {
  console.log(AUTH_LOG, '404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ error: 'Not found', path: req.path });
});
// Error handler – if server gets here, an error occurred (log and return JSON)
app.use((err, req, res, next) => {
  console.error(AUTH_LOG, 'Server error', err?.stack || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && err?.message && { detail: err.message }),
  });
});
// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(REQ_LOG, `Server listening on 0.0.0.0:${PORT} (accepts connections from LAN)`);
  console.log(REQ_LOG, `Use http://<this-pc-ip>:${PORT} from your phone (e.g. http://10.0.0.187:${PORT})`);
  console.log(AUTH_LOG, 'Auth routes mounted at /api/auth (GET /me, POST /login, POST /register, etc.)');
});
