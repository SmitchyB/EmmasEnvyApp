const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function productsEnabled() {
  const settings = await db.getSiteSettings();
  return settings == null || settings.products_enabled !== false;
}

// GET /api/cart – list current user's cart (auth required)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!(await productsEnabled())) {
      return res.status(403).json({ error: 'Products are currently disabled.' });
    }
    const items = await db.getCartByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart – add one item (auth required)
// Body: { productId, variantId?, quantity?, title?, price?, image? } (title/price/image optional; fetched from products if missing)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!(await productsEnabled())) {
      return res.status(403).json({ error: 'Products are currently disabled.' });
    }
    const { productId, variantId, quantity = 1, title, price, image } = req.body;
    if (productId == null || Number.isNaN(Number(productId))) {
      return res.status(400).json({ error: 'productId is required' });
    }
    const qty = Math.max(1, Math.min(999, Number(quantity) || 1));
    let opts = { title: title ?? '', price: Number(price) || 0, image: image ?? null };
    if (opts.title === '' || opts.price === 0) {
      const vid = variantId != null ? Number(variantId) : null;
      const row = await db.pool.query(
        vid != null
          ? 'SELECT p.title, p.price AS product_price, p.image AS product_image, v.price AS variant_price, v.image AS variant_image FROM emmasenvy.products p LEFT JOIN emmasenvy.product_variants v ON v.product_id = p.id AND v.id = $2 WHERE p.id = $1'
          : 'SELECT p.title, p.price AS product_price, p.image AS product_image, NULL::numeric AS variant_price, NULL AS variant_image FROM emmasenvy.products p WHERE p.id = $1',
        vid != null ? [Number(productId), vid] : [Number(productId)]
      );
      if (row.rows[0]) {
        const r = row.rows[0];
        if (opts.title === '') opts.title = r.title ?? '';
        if (opts.price === 0) opts.price = Number(r.variant_price ?? r.product_price) || 0;
        if (opts.image == null) opts.image = r.variant_image ?? r.product_image ?? null;
      }
    }
    await db.addCartItem(req.user.id, Number(productId), variantId != null ? Number(variantId) : null, qty, opts);
    const items = await db.getCartByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/merge – merge guest cart into user cart (auth required)
// Body: { items: [{ productId, variantId?, quantity, title?, price?, image? }] }
router.post('/merge', requireAuth, async (req, res, next) => {
  try {
    if (!(await productsEnabled())) {
      return res.status(403).json({ error: 'Products are currently disabled.' });
    }
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      const cart = await db.getCartByUserId(req.user.id);
      return res.json({ items: cart });
    }
    const valid = items
      .filter((it) => it && it.productId != null && !Number.isNaN(Number(it.productId)))
      .map((it) => ({
        productId: Number(it.productId),
        variantId: it.variantId != null ? Number(it.variantId) : undefined,
        quantity: Math.max(1, Math.min(999, Number(it.quantity) || 1)),
        title: it.title ?? '',
        price: Number(it.price) || 0,
        image: it.image ?? null,
      }));
    await db.mergeCartItems(req.user.id, valid);
    const cart = await db.getCartByUserId(req.user.id);
    res.json({ items: cart });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/:productId – remove one line (no variant)
router.delete('/:productId', requireAuth, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid productId' });
    }
    await db.removeCartItem(req.user.id, productId, undefined);
    const items = await db.getCartByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/:productId/:variantId – remove one line (with variant)
router.delete('/:productId/:variantId', requireAuth, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);
    if (Number.isNaN(productId) || Number.isNaN(variantId)) {
      return res.status(400).json({ error: 'Invalid productId or variantId' });
    }
    await db.removeCartItem(req.user.id, productId, variantId);
    const items = await db.getCartByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cart/:productId – set quantity (no variant). Body: { quantity }
router.patch('/:productId', requireAuth, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid productId' });
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative number' });
    }
    await db.setCartItemQuantity(req.user.id, productId, undefined, quantity);
    const items = await db.getCartByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cart/:productId/:variantId – set quantity (with variant). Body: { quantity }
router.patch('/:productId/:variantId', requireAuth, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);
    const quantity = Number(req.body?.quantity);
    if (Number.isNaN(productId) || Number.isNaN(variantId)) {
      return res.status(400).json({ error: 'Invalid productId or variantId' });
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative number' });
    }
    await db.setCartItemQuantity(req.user.id, productId, variantId, quantity);
    const items = await db.getCartByUserId(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
