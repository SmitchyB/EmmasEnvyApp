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
const portfolioRoutes = require('./routes/portfolios'); // Import the portfolio routes
const serviceTypesRoutes = require('./routes/serviceTypes'); // Import the service types routes
const appointmentsRoutes = require('./routes/appointments'); // Import the appointments routes
const promoCodesRoutes = require('./routes/promoCodes'); // Import the promo codes routes
const rewardOfferingsRoutes = require('./routes/rewardOfferings'); // Import the reward offerings routes
const newslettersRoutes = require('./routes/newsletters'); // Import the newsletters routes
const posRoutes = require('./routes/pos'); // Import the pos routes
const invoicesRoutes = require('./routes/invoices'); // Import the invoices routes
const notificationPreferencesRoutes = require('./routes/notificationPreferences'); // Import the notification preferences routes
const dataPrivacyRoutes = require('./routes/dataPrivacy'); // Import the data privacy routes
const siteSettingsRoutes = require('./routes/siteSettings'); // Import the site settings routes
const supportTicketsRoutes = require('./routes/supportTickets'); // Import the support tickets routes
const db = require('./lib/db'); // Pool for background jobs
const { sweepExpiredPendingCustomer } = require('./lib/supportTicketLifecycle');
const UPLOADS_DIR = path.join(__dirname, 'uploads'); // Define the uploads directory
const PROFILE_PHOTOS_DIR = path.join(UPLOADS_DIR, 'profile_photos');
const PORTFOLIO_PHOTOS_DIR = path.join(UPLOADS_DIR, 'portfolio'); // Define the portfolio photos directory
const SUPPORT_UPLOAD_DIR = path.join(UPLOADS_DIR, 'support'); // Define the support upload directory
fs.mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true }); // Create the profile photos directory
fs.mkdirSync(PORTFOLIO_PHOTOS_DIR, { recursive: true }); // Create the portfolio photos directory
fs.mkdirSync(SUPPORT_UPLOAD_DIR, { recursive: true }); // Create the support upload directory
const app = express(); // Create the express application
const PORT = process.env.PORT || 5000; // Define the port
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:4321'; // Define the client URL
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});

app.use('/api/auth', authRoutes); // Mount the auth routes
app.use('/api/portfolios', portfolioRoutes); // Mount the portfolio routes
app.use('/api/service-types', serviceTypesRoutes); // Mount the service types routes
app.use('/api/appointments', appointmentsRoutes); // Mount the appointments routes
app.use('/api/promo-codes', promoCodesRoutes); // Mount the promo codes routes
app.use('/api/reward-offerings', rewardOfferingsRoutes); // Mount the reward offerings routes
app.use('/api/newsletters', newslettersRoutes); // Mount the newsletters routes
app.use('/api/pos', posRoutes); // Mount the pos routes
app.use('/api/invoices', invoicesRoutes); // Mount the invoices routes
app.use('/api/notification-preferences', notificationPreferencesRoutes); // Mount the notification preferences routes
app.use('/api/data-privacy', dataPrivacyRoutes); // Mount the data privacy routes
app.use('/api/site-settings', siteSettingsRoutes); // Mount the site settings routes
app.use('/api/support-tickets', supportTicketsRoutes); // Mount the support tickets routes
app.use('/uploads', express.static(UPLOADS_DIR)); // Mount the uploads directory

app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});
app.use((err, req, res, next) => {
  console.error('Server error', err?.stack || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && err?.message && { detail: err.message }),
  });
});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  const sixHoursMs = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    sweepExpiredPendingCustomer(db.pool).catch((e) => console.error('support ticket auto-close sweep', e));
  }, 60_000);
  setInterval(() => {
    sweepExpiredPendingCustomer(db.pool).catch((e) => console.error('support ticket auto-close sweep', e));
  }, sixHoursMs);
});
