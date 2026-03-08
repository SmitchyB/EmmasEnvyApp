const express = require('express');
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { productImageUpload } = require('../lib/upload');

const router = express.Router();
const PRODUCTS_TABLE = 'emmasenvy.products';
const VARIANTS_TABLE = 'emmasenvy.product_variants';

const PRODUCT_COLUMNS = 'id, title, description, category, price, stock, image, tags, variant_type, status, created_at, updated_at, sku';

function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    price: Number(row.price),
    stock: row.stock != null ? Number(row.stock) : 0,
    image: row.image ?? null,
    tags: row.tags ?? null,
    variant_type: row.variant_type ?? null,
    status: row.status,
    sku: row.sku ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToVariant(row) {
  if (!row) return null;
  return {
    id: row.id,
    product_id: row.product_id,
    name: row.name,
    price: Number(row.price),
    image: row.image ?? null,
    hex: row.hex ?? null,
    default: row.default === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/products – list active products with variants (empty when products disabled)
router.get('/', async (req, res, next) => {
  try {
    const settings = await db.getSiteSettings();
    if (settings && settings.products_enabled === false) {
      return res.json({ products: [] });
    }
    const productsResult = await db.pool.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM ${PRODUCTS_TABLE}
       WHERE status = 'active'
       ORDER BY id`
    );
    const products = productsResult.rows.map(rowToProduct);

    if (products.length === 0) {
      return res.json({ products: [] });
    }

    const variantsResult = await db.pool.query(
      `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at
       FROM ${VARIANTS_TABLE}
       WHERE product_id = ANY($1::int[])
       ORDER BY product_id, id`,
      [products.map((p) => p.id)]
    );
    const variantsByProductId = {};
    for (const row of variantsResult.rows) {
      const v = rowToVariant(row);
      if (!variantsByProductId[row.product_id]) variantsByProductId[row.product_id] = [];
      variantsByProductId[row.product_id].push(v);
    }

    products.forEach((p) => {
      p.variants = variantsByProductId[p.id] || [];
    });

    res.json({ products });
  } catch (err) {
    console.error('[Products] GET / error', err);
    return next(err);
  }
});

// GET /api/products/admin – list products for manager; default all (active + inactive); ?status=active|inactive|all
router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const statusFilter = (req.query.status || 'all').toLowerCase();
    let whereClause = '';
    const params = [];
    if (statusFilter === 'active' || statusFilter === 'inactive') {
      whereClause = ' WHERE status = $1';
      params.push(statusFilter);
    }
    const productsResult = await db.pool.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM ${PRODUCTS_TABLE}
       ${whereClause}
       ORDER BY id`,
      params
    );
    const products = productsResult.rows.map(rowToProduct);

    if (products.length === 0) {
      return res.json({ products: [] });
    }

    const variantsResult = await db.pool.query(
      `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at
       FROM ${VARIANTS_TABLE}
       WHERE product_id = ANY($1::int[])
       ORDER BY product_id, id`,
      [products.map((p) => p.id)]
    );
    const variantsByProductId = {};
    for (const row of variantsResult.rows) {
      const v = rowToVariant(row);
      if (!variantsByProductId[row.product_id]) variantsByProductId[row.product_id] = [];
      variantsByProductId[row.product_id].push(v);
    }
    products.forEach((p) => {
      p.variants = variantsByProductId[p.id] || [];
    });

    res.json({ products });
  } catch (err) {
    console.error('[Products] GET /admin error', err);
    return next(err);
  }
});

// POST /api/products – create product (admin only); accepts JSON or multipart with optional image
router.post('/', requireAuth, requireAdmin, productImageUpload.single('image'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = body.title;
    if (!title || (typeof title !== 'string' && typeof title !== 'number') || String(title).trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }
    const cat = (body.category ?? '').toString().trim() || 'Jewelry';
    const priceNum = Number(body.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    const stockNum = body.stock != null ? parseInt(body.stock, 10) : 0;
    const stockVal = Number.isNaN(stockNum) || stockNum < 0 ? 0 : stockNum;
    const statusVal = (body.status ?? 'active').toString().trim() || 'active';
    const imageVal = req.file
      ? `products/${req.file.filename}`
      : (body.image != null && body.image !== '' ? String(body.image).trim() : null);
    const skuVal = body.sku != null && String(body.sku).trim() !== '' ? String(body.sku).trim() : null;

    const result = await db.pool.query(
      `INSERT INTO ${PRODUCTS_TABLE} (title, description, category, price, stock, image, status, sku, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING ${PRODUCT_COLUMNS}`,
      [String(title).trim(), (body.description ?? '').toString().trim() || null, cat, priceNum, stockVal, imageVal, statusVal, skuVal]
    );
    const row = result.rows[0];
    const product = rowToProduct(row);
    product.variants = [];
    res.status(201).json({ product });
  } catch (err) {
    console.error('[Products] POST / error', err);
    return next(err);
  }
});

// GET /api/products/:id – single product with variants
router.get('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  try {
    const productResult = await db.pool.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM ${PRODUCTS_TABLE}
       WHERE id = $1`,
      [id]
    );
    const row = productResult.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = rowToProduct(row);

    const variantsResult = await db.pool.query(
      `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at
       FROM ${VARIANTS_TABLE}
       WHERE product_id = $1
       ORDER BY id`,
      [id]
    );
    product.variants = variantsResult.rows.map(rowToVariant);

    res.json({ product });
  } catch (err) {
    console.error('[Products] GET /:id error', err);
    return next(err);
  }
});

// PUT /api/products/:id – update product (admin only); accepts JSON or multipart with optional image
router.put('/:id', requireAuth, requireAdmin, productImageUpload.single('image'), async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  try {
    const body = req.body || {};
    const existing = await db.pool.query(
      `SELECT id FROM ${PRODUCTS_TABLE} WHERE id = $1`,
      [id]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const updates = [];
    const values = [];
    let idx = 1;
    if (body.title !== undefined && body.title !== '') {
      updates.push(`title = $${idx++}`);
      values.push(typeof body.title === 'string' ? body.title.trim() : String(body.title));
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(body.description != null && body.description !== '' ? String(body.description).trim() : null);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${idx++}`);
      values.push((body.category ?? '').toString().trim() || 'Jewelry');
    }
    if (body.price !== undefined) {
      const priceNum = Number(body.price);
      if (!Number.isNaN(priceNum) && priceNum >= 0) {
        updates.push(`price = $${idx++}`);
        values.push(priceNum);
      }
    }
    if (body.stock !== undefined) {
      const stockNum = parseInt(body.stock, 10);
      updates.push(`stock = $${idx++}`);
      values.push(Number.isNaN(stockNum) || stockNum < 0 ? 0 : stockNum);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push((body.status ?? 'active').toString().trim() || 'active');
    }
    if (req.file) {
      updates.push(`image = $${idx++}`);
      values.push(`products/${req.file.filename}`);
    } else if (body.image !== undefined) {
      updates.push(`image = $${idx++}`);
      values.push(body.image != null && body.image !== '' ? String(body.image).trim() : null);
    }
    if (body.sku !== undefined) {
      updates.push(`sku = $${idx++}`);
      values.push(body.sku != null && String(body.sku).trim() !== '' ? String(body.sku).trim() : null);
    }
    if (updates.length === 0) {
      const productResult = await db.pool.query(
        `SELECT ${PRODUCT_COLUMNS} FROM ${PRODUCTS_TABLE} WHERE id = $1`,
        [id]
      );
      const product = rowToProduct(productResult.rows[0]);
      const variantsResult = await db.pool.query(
        `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at FROM ${VARIANTS_TABLE} WHERE product_id = $1 ORDER BY id`,
        [id]
      );
      product.variants = variantsResult.rows.map(rowToVariant);
      return res.json({ product });
    }
    updates.push('updated_at = NOW()');
    values.push(id);
    const result = await db.pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET ${updates.join(', ')} WHERE id = $${idx} RETURNING ${PRODUCT_COLUMNS}`,
      values
    );
    const product = rowToProduct(result.rows[0]);
    const variantsResult = await db.pool.query(
      `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at FROM ${VARIANTS_TABLE} WHERE product_id = $1 ORDER BY id`,
      [id]
    );
    product.variants = variantsResult.rows.map(rowToVariant);
    res.json({ product });
  } catch (err) {
    console.error('[Products] PUT /:id error', err);
    return next(err);
  }
});

// PATCH /api/products/:id/stock – set stock quantity (admin only)
router.patch('/:id/stock', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  const quantity = req.body != null && typeof req.body.quantity !== 'undefined'
    ? parseInt(req.body.quantity, 10)
    : NaN;
  if (Number.isNaN(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'quantity must be a non-negative number' });
  }
  try {
    const result = await db.pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET stock = $1, updated_at = NOW() WHERE id = $2 RETURNING ${PRODUCT_COLUMNS}`,
      [quantity, id]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = rowToProduct(row);
    const variantsResult = await db.pool.query(
      `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at FROM ${VARIANTS_TABLE} WHERE product_id = $1 ORDER BY id`,
      [id]
    );
    product.variants = variantsResult.rows.map(rowToVariant);
    res.json({ product });
  } catch (err) {
    console.error('[Products] PATCH /:id/stock error', err);
    return next(err);
  }
});

// PATCH /api/products/:id/status – set active/inactive (admin only)
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  const status = (req.body && req.body.status) ? String(req.body.status).trim().toLowerCase() : '';
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ error: 'status must be "active" or "inactive"' });
  }
  try {
    const result = await db.pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING ${PRODUCT_COLUMNS}`,
      [status, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = rowToProduct(result.rows[0]);
    const variantsResult = await db.pool.query(
      `SELECT id, product_id, name, price, image, hex, "default", created_at, updated_at FROM ${VARIANTS_TABLE} WHERE product_id = $1 ORDER BY id`,
      [id]
    );
    product.variants = variantsResult.rows.map(rowToVariant);
    res.json({ product });
  } catch (err) {
    console.error('[Products] PATCH /:id/status error', err);
    return next(err);
  }
});

// DELETE /api/products/:id – hard delete (admin only); remove from DB immediately
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  try {
    await db.pool.query(`DELETE FROM ${VARIANTS_TABLE} WHERE product_id = $1`, [id]);
    const result = await db.pool.query(
      `DELETE FROM ${PRODUCTS_TABLE} WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('[Products] DELETE /:id error', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot remove product: it is referenced by orders or other data.' });
    }
    return next(err);
  }
});

module.exports = router;
