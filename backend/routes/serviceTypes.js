const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const TABLE = 'emmasenvy.service_type';

/**
 * Normalize duration_needed for API: pg returns interval as an object (postgres-interval)
 * with hours, minutes, seconds, etc. Convert to "HH:MM:SS" string for frontend display.
 */
function durationToDisplayString(duration) {
	if (duration == null) return null;
	if (typeof duration === 'string') return duration;
	// postgres-interval object: { years, months, days, hours, minutes, seconds, milliseconds }
	const h = Math.floor(Number(duration.hours) || 0);
	const m = Math.floor(Number(duration.minutes) || 0);
	const s = Math.floor(Number(duration.seconds) || 0);
	const days = Math.floor(Number(duration.days) || 0);
	const totalHours = h + days * 24;
	const pad = (n) => String(n).padStart(2, '0');
	// Frontend expects "HH:MM:SS" for formatDuration; omit milliseconds for compatibility
	return `${pad(totalHours)}:${pad(m)}:${pad(s)}`;
}

function rowToServiceType(row) {
	if (!row) return null;
	return {
		id: row.id,
		employee_id: row.employee_id ?? null,
		title: row.title ?? '',
		description: row.description ?? null,
		duration_needed: durationToDisplayString(row.duration_needed),
		price: row.price != null ? Number(row.price) : null,
		tags: Array.isArray(row.tags) ? row.tags : row.tags ?? null,
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
	};
}

const router = express.Router();

// GET /api/service-types/public – list bookable service types (no auth; for /book page)
router.get('/public', async (req, res, next) => {
	try {
		const result = await db.pool.query(
			`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at
       FROM ${TABLE}
       WHERE employee_id IS NOT NULL
       ORDER BY id`
		);
		const serviceTypes = result.rows.map(rowToServiceType);
		res.json(serviceTypes);
	} catch (err) {
		console.error('[ServiceTypes] GET /public error', err);
		return next(err);
	}
});

// GET /api/service-types – list service types (scoped to current user via employee_id)
router.get('/', requireAuth, async (req, res, next) => {
	try {
		const userId = req.user.id;
		const result = await db.pool.query(
			`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at
       FROM ${TABLE}
       WHERE employee_id IS NULL OR employee_id = $1
       ORDER BY id`,
			[userId]
		);
		const serviceTypes = result.rows.map(rowToServiceType);
		res.json(serviceTypes);
	} catch (err) {
		console.error('[ServiceTypes] GET / error', err);
		return next(err);
	}
});

// POST /api/service-types – create (auth required)
router.post('/', requireAuth, async (req, res, next) => {
	try {
		const { title, description, duration_needed, price, tags } = req.body;
		if (!title || typeof title !== 'string' || !title.trim()) {
			return res.status(400).json({ error: 'Title is required' });
		}
		const employeeId = req.user.id;
		const now = new Date();
		const result = await db.pool.query(
			`INSERT INTO ${TABLE} (employee_id, title, description, duration_needed, price, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4::interval, $5, $6, $7, $7)
       RETURNING id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at`,
			[
				employeeId,
				title.trim(),
				description != null && description !== '' ? String(description).trim() : null,
				duration_needed != null && String(duration_needed).trim() !== '' ? String(duration_needed).trim() : null,
				price != null && price !== '' ? Number(price) : null,
				Array.isArray(tags) && tags.length > 0 ? tags : null,
				now,
			]
		);
		const row = result.rows[0];
		res.status(201).json(rowToServiceType(row));
	} catch (err) {
		console.error('[ServiceTypes] POST / error', err);
		return next(err);
	}
});

// PUT /api/service-types/:id – update (auth required)
router.put('/:id', requireAuth, async (req, res, next) => {
	try {
		const id = parseInt(req.params.id, 10);
		if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
		const { title, description, duration_needed, price, tags } = req.body;
		const now = new Date();

		const updates = [];
		const values = [];
		let idx = 1;
		if (title !== undefined) {
			const t = typeof title === 'string' ? title.trim() : '';
			if (!t) return res.status(400).json({ error: 'Title is required' });
			updates.push(`title = $${idx++}`);
			values.push(t);
		}
		if (description !== undefined) {
			updates.push(`description = $${idx++}`);
			values.push(description != null && description !== '' ? String(description).trim() : null);
		}
		if (duration_needed !== undefined) {
			updates.push(`duration_needed = $${idx++}::interval`);
			values.push(
				duration_needed != null && String(duration_needed).trim() !== '' ? String(duration_needed).trim() : null
			);
		}
		if (price !== undefined) {
			updates.push(`price = $${idx++}`);
			values.push(price != null && price !== '' ? Number(price) : null);
		}
		if (tags !== undefined) {
			updates.push(`tags = $${idx++}`);
			values.push(Array.isArray(tags) && tags.length > 0 ? tags : null);
		}
		if (updates.length === 0) {
			const sel = await db.pool.query(
				`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at FROM ${TABLE} WHERE id = $1`,
				[id]
			);
			const row = sel.rows[0];
			if (!row) return res.status(404).json({ error: 'Service type not found' });
			return res.json(rowToServiceType(row));
		}
		updates.push(`updated_at = $${idx++}`);
		values.push(now, id);
		await db.pool.query(
			`UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = $${idx}`,
			values
		);
		const sel = await db.pool.query(
			`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at FROM ${TABLE} WHERE id = $1`,
			[id]
		);
		const row = sel.rows[0];
		if (!row) return res.status(404).json({ error: 'Service type not found' });
		res.json(rowToServiceType(row));
	} catch (err) {
		console.error('[ServiceTypes] PUT /:id error', err);
		return next(err);
	}
});

// DELETE /api/service-types/:id – remove (auth required)
router.delete('/:id', requireAuth, async (req, res, next) => {
	try {
		const id = parseInt(req.params.id, 10);
		if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
		const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]);
		if (result.rowCount === 0) return res.status(404).json({ error: 'Service type not found' });
		res.status(204).send();
	} catch (err) {
		console.error('[ServiceTypes] DELETE /:id error', err);
		return next(err);
	}
});

module.exports = router;
