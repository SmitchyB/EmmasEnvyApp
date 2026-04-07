const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module
const { requireAuth } = require('../middleware/auth'); // Import the requireAuth middleware

const TABLE = 'emmasenvy.service_type'; // Import the TABLE module from the constants module

// Define the durationToDisplayString function to convert the duration to a display string
function durationToDisplayString(duration) {
	if (duration == null) return null; // If the duration is null, return null
	if (typeof duration === 'string') return duration; // If the duration is a string, return the duration
	const h = Math.floor(Number(duration.hours) || 0); // Get the hours from the duration
	const m = Math.floor(Number(duration.minutes) || 0); // Get the minutes from the duration
	const s = Math.floor(Number(duration.seconds) || 0); // Get the seconds from the duration
	const days = Math.floor(Number(duration.days) || 0); // Get the days from the duration
	const totalHours = h + days * 24; // Get the total hours from the duration
	const pad = (n) => String(n).padStart(2, '0'); // Pad the number with 0s
	return `${pad(totalHours)}:${pad(m)}:${pad(s)}`; // Return the duration in the format of hours:minutes:seconds
}

// Define the rowToServiceType function to convert the row to a service type object
function rowToServiceType(row) {
	if (!row) return null; // If the row is not found, return null
	return {
		id: row.id, // Set the id of the service type
		employee_id: row.employee_id ?? null, // Set the employee id of the service type
		title: row.title ?? '', // Set the title of the service type
		description: row.description ?? null, // Set the description of the service type
		duration_needed: durationToDisplayString(row.duration_needed), // Set the duration needed of the service type
		price: row.price != null ? Number(row.price) : null, // Set the price of the service type
		tags: Array.isArray(row.tags) ? row.tags : row.tags ?? null, // Set the tags of the service type
		created_at: row.created_at ?? null, // Set the created at of the service type
		updated_at: row.updated_at ?? null, // Set the updated at of the service type
	};
}

const router = express.Router(); // Create a new router

// GET /api/service-types/public – list bookable service types (no auth; for /book page)
router.get('/public', async (req, res, next) => {
	// Try to get the service types
	try {
		// Try to get the service types
		const result = await db.pool.query(
			`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at
       FROM ${TABLE}
       WHERE employee_id IS NOT NULL
       ORDER BY id`
		);
		const serviceTypes = result.rows.map(rowToServiceType); // Map the rows to service type objects
		res.json(serviceTypes); // Return the service types as a JSON object
	} catch (err) {
		console.error('[ServiceTypes] GET /public error', err); // Log the error
		return next(err); // Return the error
	}
});

// GET /api/service-types – list service types (scoped to current user via employee_id)
router.get('/', requireAuth, async (req, res, next) => {
	// Try to get the service types
	try {
		const userId = req.user.id; // Get the user id from the request
		// Try to get the service types
		const result = await db.pool.query(
			`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at
       FROM ${TABLE}
       WHERE employee_id IS NULL OR employee_id = $1
       ORDER BY id`,
			[userId]
		);
		const serviceTypes = result.rows.map(rowToServiceType); // Map the rows to service type objects
		res.json(serviceTypes); // Return the service types as a JSON object
	} catch (err) {
		console.error('[ServiceTypes] GET / error', err); // Log the error
		return next(err); // Return the error
	}
});

// POST /api/service-types – create (auth required)
router.post('/', requireAuth, async (req, res, next) => {
	// Try to create the service type
	try {
		// Try to get the title, description, duration needed, price, and tags from the request
		const { title, description, duration_needed, price, tags } = req.body;
		// Return an error if the title is not set
		if (!title || typeof title !== 'string' || !title.trim()) {
			return res.status(400).json({ error: 'Title is required' }); // Return an error Title is required
		}
		const employeeId = req.user.id; // Get the employee id from the request
		const now = new Date(); // Get the current date
		// Try to insert the service type
		const result = await db.pool.query(
			`INSERT INTO ${TABLE} (employee_id, title, description, duration_needed, price, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4::interval, $5, $6, $7, $7)
       RETURNING id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at`,
			[
				employeeId, // Set the employee id
				title.trim(), // Set the title 
				description != null && description !== '' ? String(description).trim() : null, // Set the description
				duration_needed != null && String(duration_needed).trim() !== '' ? String(duration_needed).trim() : null, // Set the duration needed
				price != null && price !== '' ? Number(price) : null, // Set the price
				Array.isArray(tags) && tags.length > 0 ? tags : null, // Set the tags
				now, // Set the current date
			]
		);
		const row = result.rows[0]; // Get the row from the result
		res.status(201).json(rowToServiceType(row)); // Return the service type as a JSON object
	} catch (err) {
		console.error('[ServiceTypes] POST / error', err); // Log the error
		return next(err); // Return the error
	}
});

// PUT /api/service-types/:id – update (auth required)
router.put('/:id', requireAuth, async (req, res, next) => {
	// Try to update the service type
	try {
		// Try to get the id, title, description, duration needed, price, and tags from the request
		const id = parseInt(req.params.id, 10); // Get the id from the request
		if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Return an error if the id is not a number
		const { title, description, duration_needed, price, tags } = req.body; // Get the title, description, duration needed, price, and tags from the request
		const now = new Date(); // Get the current date
		// Try to update the service type
		const updates = []; // Initialize the updates array
		const values = []; // Initialize the values array
		let idx = 1; // Initialize the index
		// If the title is not undefined, add it to the updates and values
		if (title !== undefined) {
			const t = typeof title === 'string' ? title.trim() : ''; // Get the title from the request
			if (!t) return res.status(400).json({ error: 'Title is required' }); // Return an error if the title is not set
			updates.push(`title = $${idx++}`); // Add the title to the updates array
			values.push(t); // Add the title to the values array
		}
		// If the description is not undefined, add it to the updates and values
		if (description !== undefined) {
			updates.push(`description = $${idx++}`); // Add the description to the updates array
			values.push(description != null && description !== '' ? String(description).trim() : null); // Add the description to the values array
		}
		// If the duration needed is not undefined, add it to the updates and values 
		if (duration_needed !== undefined) {
			updates.push(`duration_needed = $${idx++}::interval`); // Add the duration needed to the updates array
			// Add the duration needed to the values array
			values.push(
				duration_needed != null && String(duration_needed).trim() !== '' ? String(duration_needed).trim() : null
			);
		}
		// If the price is not undefined, add it to the updates and values
		if (price !== undefined) {
			updates.push(`price = $${idx++}`); // Add the price to the updates array
			values.push(price != null && price !== '' ? Number(price) : null); // Add the price to the values array
		}
		// If the tags is not undefined, add it to the updates and values
		if (tags !== undefined) {
			updates.push(`tags = $${idx++}`); // Add the tags to the updates array
			values.push(Array.isArray(tags) && tags.length > 0 ? tags : null); // Add the tags to the values array
		}
		// If the updates array is empty, select the service type
		if (updates.length === 0) {
			// Try to select the service type
			const sel = await db.pool.query(
				`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at FROM ${TABLE} WHERE id = $1`,
				[id]
			);
			const row = sel.rows[0]; // Get the row from the result
			if (!row) return res.status(404).json({ error: 'Service type not found' }); // Return an error if the service type is not found
			return res.json(rowToServiceType(row)); // Return the service type as a JSON object
		}
		updates.push(`updated_at = $${idx++}`); // Add the updated at to the updates array
		values.push(now, id); // Add the current date and id to the values array
		// Try to update the service type
		await db.pool.query(
			`UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = $${idx}`,
			values
		);
		// Try to select the service type
		const sel = await db.pool.query(
			`SELECT id, employee_id, title, description, duration_needed, price, tags, created_at, updated_at FROM ${TABLE} WHERE id = $1`,
			[id]
		);
		const row = sel.rows[0]; // Get the row from the result
		if (!row) return res.status(404).json({ error: 'Service type not found' }); // Return an error if the service type is not found	
		res.json(rowToServiceType(row)); // Return the service type as a JSON object
	} catch (err) {
		console.error('[ServiceTypes] PUT /:id error', err); // Log the error
		return next(err); // Return the error
	}
});

// DELETE /api/service-types/:id – remove (auth required)
router.delete('/:id', requireAuth, async (req, res, next) => {
	// Try to delete the service type
	try {
		const id = parseInt(req.params.id, 10); // Get the id from the request
		if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Return an error if the id is not a number
		const result = await db.pool.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]); // Try to delete the service type
		if (result.rowCount === 0) return res.status(404).json({ error: 'Service type not found' }); // Return an error if the service type is not found
		res.status(204).send(); // Return a success status
	} catch (err) {
		console.error('[ServiceTypes] DELETE /:id error', err); // Log the error
		return next(err); // Return the error
	}
});

module.exports = router; //Export the router
