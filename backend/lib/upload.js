/**
 * Shared Multer image-upload config. Exports pre-configured instances for profile, products, portfolio, etc.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { MAX_PROFILE_PHOTO_SIZE, MAX_IMAGE_SIZE } = require('./constants');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

const IMAGE_MIME_REGEX = /^image\/(jpeg|jpg|png|gif|webp)$/i;
const SAFE_EXT_REGEX = /^\.(jpe?g|png|gif|webp)$/;

function imageFileFilter(_req, file, cb) {
  cb(null, IMAGE_MIME_REGEX.test(file.mimetype));
}

function safeExt(originalname) {
  const ext = (path.extname(originalname) || '').toLowerCase();
  return SAFE_EXT_REGEX.test(ext) ? ext : '.jpg';
}

/**
 * @param {{ subdir: string, maxSize: number, getFilename?: (req: any, file: any) => string }} options
 */
function createImageUpload(options) {
  const { subdir, maxSize, getFilename } = options;
  const destDir = path.join(UPLOADS_BASE, subdir);
  fs.mkdirSync(destDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const ext = safeExt(file.originalname);
      const name = getFilename ? getFilename(req, file) : `${path.basename(subdir)}-${Date.now()}${ext}`;
      cb(null, name);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: imageFileFilter,
  });
}

const profilePhotoUpload = createImageUpload({
  subdir: 'profile_photos',
  maxSize: MAX_PROFILE_PHOTO_SIZE,
  getFilename: (req, file) => `${req.user.id}-${Date.now()}${safeExt(file.originalname)}`,
});

const productImageUpload = createImageUpload({
  subdir: 'products',
  maxSize: MAX_IMAGE_SIZE,
  getFilename: (_req, file) => `product-${Date.now()}${safeExt(file.originalname)}`,
});

const portfolioPhotoUpload = createImageUpload({
  subdir: 'portfolio',
  maxSize: MAX_IMAGE_SIZE,
  getFilename: (req, file) => `portfolio-${req.params.id || '0'}-${Date.now()}${safeExt(file.originalname)}`,
});

const finishedPhotoUpload = createImageUpload({
  subdir: 'portfolio',
  maxSize: MAX_IMAGE_SIZE,
  getFilename: (req, file) => `finished-${req.params.id || '0'}-${Date.now()}${safeExt(file.originalname)}`,
});

const homeHeroUpload = createImageUpload({
  subdir: 'home_hero',
  maxSize: MAX_IMAGE_SIZE,
  getFilename: (_req, file) => `hero-${Date.now()}${safeExt(file.originalname)}`,
});

const supportPhotoUpload = createImageUpload({
  subdir: 'support',
  maxSize: MAX_IMAGE_SIZE,
  getFilename: (req, file) => {
    const uid = req.user?.id ?? 'anon';
    const shortRandom = Math.random().toString(36).slice(2, 10);
    return `support-${uid}-${Date.now()}-${shortRandom}${safeExt(file.originalname)}`;
  },
});

module.exports = {
  profilePhotoUpload,
  productImageUpload,
  portfolioPhotoUpload,
  finishedPhotoUpload,
  homeHeroUpload,
  supportPhotoUpload,
};
