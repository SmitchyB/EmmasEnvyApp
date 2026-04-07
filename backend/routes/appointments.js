const path = require('path'); // Import the path module
const fs = require('fs'); // Import the fs module
const jwt = require('jsonwebtoken'); // Import the jsonwebtoken module
const express = require('express'); // Import the express module
const db = require('../lib/db'); // Import the db module
const { requireAuth, requireAdminOrIT, optionalAuth } = require('../middleware/auth'); // Import the requireAuth, requireAdminOrIT, and optionalAuth middleware
const { DEFAULT_CURRENCY } = require('../lib/constants'); // Import the DEFAULT_CURRENCY module
const { appointmentCompletedPhotoUpload } = require('../lib/upload'); // Import the appointmentCompletedPhotoUpload function from the upload module
const APPOINTMENTS_TABLE = 'emmasenvy.appointments'; // Import the APPOINTMENTS_TABLE module from the constants module
const PORTFOLIO_PHOTOS_TABLE = 'emmasenvy.portfolio_photos'; // Import the PORTFOLIO_PHOTOS_TABLE module from the constants module
const INVOICES_TABLE = 'emmasenvy.invoices'; // Import the INVOICES_TABLE module from the constants module
const SERVICE_TYPE_TABLE = 'emmasenvy.service_type'; // Import the SERVICE_TYPE_TABLE module from the constants module
const PORTFOLIOS_TABLE = 'emmasenvy.portfolios'; // Import the PORTFOLIOS_TABLE module from the constants module
const DEFAULT_DAY_START = '08:00'; // Import the DEFAULT_DAY_START module from the constants module
const DEFAULT_DAY_END = '18:00'; // Import the DEFAULT_DAY_END module from the constants module
const SLOT_STEP_MINUTES = 15; // Import the SLOT_STEP_MINUTES module from the constants module
const DEFAULT_PAYMENT_METHOD = process.env.DEFAULT_PAYMENT_METHOD || 'pending'; // Import the DEFAULT_PAYMENT_METHOD module from the constants module
const STATUS_CANCELED = process.env.STATUS_CANCELED || 'Canceled'; // Import the STATUS_CANCELED module from the constants module
const STATUS_PENDING = 'Pending'; // Import the STATUS_PENDING module from the constants module
const STATUS_CONFIRMED = 'Confirmed'; // Import the STATUS_CONFIRMED module from the constants module
const STATUS_CHECKED_IN = 'Checked In'; // Import the STATUS_CHECKED_IN module from the constants module
const STATUS_IN_PROGRESS = 'In Progress'; // Import the STATUS_IN_PROGRESS module from the constants module
const STATUS_COMPLETE = 'Complete'; // Import the STATUS_COMPLETE module from the constants module
const STATUS_PAID = 'Paid'; // Import the STATUS_PAID module from the constants module
const WORKFLOW_STATUSES = [STATUS_PENDING, STATUS_CONFIRMED, STATUS_CHECKED_IN, STATUS_IN_PROGRESS, STATUS_COMPLETE, STATUS_PAID]; // Ordered workflow statuses for staff transitions
const JWT_SECRET = process.env.JWT_SECRET; // Import the JWT_SECRET module from the constants module

// Define the isStaffRole function
function isStaffRole(user) {
  if (!user || !user.role) return false; // If the user is not found or the role is not found, return false
  const r = String(user.role).toLowerCase(); // Normalize role string for comparison
  return r === 'admin' || r === 'it'; // Return true if the role is admin or it
}

// Define the normalizeApptStatus function to normalize the appointment status
function normalizeApptStatus(s) {
  const t = String(s || '').trim(); // Convert the status to a string and trim the whitespace
  if (t === 'Completed') return STATUS_COMPLETE; // If the status is Completed, return the STATUS_COMPLETE module
  return t; // Return the status
}
// Define the workflowIndex function to get the index of the status in the WORKFLOW_STATUSES array
function workflowIndex(status) {
  const n = normalizeApptStatus(status); // Convert the status to a string and trim the whitespace
  return WORKFLOW_STATUSES.indexOf(n); // Return the index of the status in the WORKFLOW_STATUSES array
}
// Function to assert the staff status transition
function assertStaffStatusTransition(currentRaw, nextRaw) {
  const current = normalizeApptStatus(currentRaw); // Convert the status to a string and trim the whitespace
  const next = normalizeApptStatus(nextRaw); // Convert the status to a string and trim the whitespace
  // If the next status is Paid, throw an error
  if (next === STATUS_PAID) {
    const err = new Error('Record payment to mark an appointment as paid'); // Create a new error
    err.statusCode = 400; // Set the status code to 400
    throw err; // Throw the error
  }
  const i = workflowIndex(current); // Get the index of the current status in the WORKFLOW_STATUSES array
  const j = workflowIndex(next); // Get the index of the next status in the WORKFLOW_STATUSES array
  // If the next status is not found in the WORKFLOW_STATUSES array, throw an error
  if (j === -1) {
    const err = new Error('Invalid status'); // Create a new error
    err.statusCode = 400; // Set the status code to 400
    throw err; // Throw the error
  }
  // If the current status is not found in the WORKFLOW_STATUSES array, throw an error
  if (i === -1) {
    // If the current status is Canceled, throw an error
    if (current === STATUS_CANCELED) {
      const err = new Error('Cannot change status of a canceled appointment'); // Create a new error
      err.statusCode = 400; // Set the status code to 400
      throw err; // Throw the error
    }
    return; // Return
  }
  // If the next status is not one step ahead of the current status, throw an error
  if (j !== i + 1) {
    const err = new Error(`Invalid status transition: ${current} → ${next}`); // Create a new error
    err.statusCode = 400; // Set the status code to 400
    throw err; // Throw the error
  }
}
// Function to select the appointment from the joins 
function appointmentSelectFromJoins() {
  return `a.id, a.client_id, a.client_name, a.client_email, a.client_phone, a.employee_id, a.date, a.time, a.description, a.inspo_pics, a.completed_photos, a.status, a.created_by, a.created_at, a.updated_at, a.duration, a.invoice_id, a.service_type_id,
    a.confirmed_at, a.checked_in_at, a.in_progress_at, a.completed_at, a.paid_at, a.canceled_at, a.rescheduled_at,
    st.title AS service_type_title,
    i.payment_status AS invoice_payment_status, i.total_amount AS invoice_total_amount`;
}
// Function to join the appointment with the invoices and service types
function appointmentJoins() {
  // Return the SQL fragment to join the appointment with the invoices and service types
  return `FROM ${APPOINTMENTS_TABLE} a
    LEFT JOIN ${INVOICES_TABLE} i ON i.id = a.invoice_id 
    LEFT JOIN ${SERVICE_TYPE_TABLE} st ON st.id = a.service_type_id`;
}
// Function to convert the row to an appointment
function rowToAppointment(row) {
  if (!row) return null; // If the row is not found, return null
  const dateNorm = row.date != null ? pgDateStr(row.date).slice(0, 10) : ''; // Convert the date to a string and slice the first 10 characters
  return {
    id: row.id, // Set the id of the appointment
    client_id: row.client_id ?? null, // Set the client id of the appointment
    client_name: row.client_name ?? '', // Set the client name of the appointment
    client_email: row.client_email ?? null, // Set the client email of the appointment
    client_phone: row.client_phone ?? null, // Set the client phone of the appointment
    employee_id: row.employee_id ?? null, // Set the employee id of the appointment
    date: dateNorm || null, // Set the date of the appointment
    time: row.time ?? null, // Set the time of the appointment
    description: row.description ?? null, // Set the description of the appointment
    inspo_pics: Array.isArray(row.inspo_pics) ? row.inspo_pics : row.inspo_pics ?? null, // Set the inspiration pictures of the appointment
    // Set the completed photos of the appointment
    completed_photos: Array.isArray(row.completed_photos)
      ? row.completed_photos 
      : row.completed_photos != null
        ? [row.completed_photos]
        : null, // Set the completed photos of the appointment
    status: row.status ?? null, // Set the status of the appointment
    created_by: row.created_by ?? null, // Set the created by of the appointment
    created_at: row.created_at ?? null, // Set the created at of the appointment
    updated_at: row.updated_at ?? null, // Set the updated at of the appointment
    duration: row.duration ?? null, // Set the duration of the appointment
    invoice_id: row.invoice_id ?? null, // Set the invoice id of the appointment
    service_type_id: row.service_type_id ?? null, // Set the service type id of the appointment
    service_type_title: row.service_type_title ?? null, // Set the service type title of the appointment
    confirmed_at: row.confirmed_at ?? null, // Set the confirmed at of the appointment
    checked_in_at: row.checked_in_at ?? null, // Set the checked in at of the appointment
    in_progress_at: row.in_progress_at ?? null, // Set the in progress at of the appointment
    completed_at: row.completed_at ?? null, // Set the completed at of the appointment
    paid_at: row.paid_at ?? null, // Set the paid at of the appointment
    canceled_at: row.canceled_at ?? null, // Set the canceled at of the appointment
    rescheduled_at: row.rescheduled_at ?? null, // Set the rescheduled at of the appointment
    invoice_payment_status: row.invoice_payment_status ?? null, // Set the invoice payment status of the appointment
    invoice_total_amount: row.invoice_total_amount != null ? Number(row.invoice_total_amount) : null, // Set the invoice total amount of the appointment
  };
}
// Function to convert the duration to minutes
function durationToMinutes(duration) {
  if (duration == null) return 0; // If the duration is null, return 0
  // If the duration is an object and the hours or minutes are not null, return the duration in minutes
  if (typeof duration === 'object' && (duration.hours != null || duration.minutes != null)) {
    const h = Math.floor(Number(duration.hours) || 0); // Set the hours of the duration
    const m = Math.floor(Number(duration.minutes) || 0); // Set the minutes of the duration
    const s = Math.floor(Number(duration.seconds) || 0); // Set the seconds of the duration 
    const days = Math.floor(Number(duration.days) || 0); // Set the days of the duration
    return (h + days * 24) * 60 + m + s / 60; // Return the duration in minutes
  }
  const str = String(duration).trim(); // Convert the duration to a string and trim the whitespace
  const match = str.match(/^(\d+):(\d+)(?::(\d+))?$/); // Match the duration to the pattern
  // If the match is found, return the duration in minutes
  if (match) {
    const h = parseInt(match[1], 10); // Convert the hours to an integer
    const m = parseInt(match[2], 10); // Convert the minutes to an integer
    const s = match[3] ? parseInt(match[3], 10) : 0; // Convert the seconds to an integer
    return h * 60 + m + s / 60; // Return the duration in minutes
  }
  return 0; // If the duration is not an object and the hours or minutes are not null, return 0
}

// Function to convert the time to minutes
function timeToMinutes(t) {
  if (!t) return 0; // If the time is null, return 0
  const str = String(t).trim(); // Convert the time to a string and trim the whitespace
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); // Match the time to the pattern
  // If the match is found, return the time in minutes
  if (match) {
    const h = parseInt(match[1], 10); // Convert the hours to an integer
    const m = parseInt(match[2], 10); // Convert the minutes to an integer
    return h * 60 + m; // Return the time in minutes
  }
  return 0; // If the time is not found, return 0
}

// Function to convert the minutes to a time string
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24; // Convert the minutes to hours
  const m = Math.floor(minutes % 60); // Convert the minutes to minutes
  const pad = (n) => String(n).padStart(2, '0'); // Pad the number with 0s
  return `${pad(h)}:${pad(m)}`; // Return the time in the format of hours:minutes
}
// Function to convert the date to a string
function pgDateStr(d) {
  if (d == null) return ''; // If the date is null, return an empty string
  if (typeof d === 'string') return d.slice(0, 10); // If the date is a string, return the date sliced to the first 10 characters
  if (d instanceof Date) return d.toISOString().slice(0, 10); // If the date is a date, return the date sliced to the first 10 characters
  return String(d).slice(0, 10); // If the date is not a string or a date, return the date sliced to the first 10 characters
}

// Function to convert the time to a time slot key
function timeSlotKey(t) {
  if (t == null) return ''; // If the time is null, return an empty string
  const s = String(t).trim(); // Convert the time to a string and trim the whitespace
  const m = s.match(/^(\d{1,2}):(\d{2})/); // Match the time to the pattern
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5); // Return the time in the format of hours:minutes
}
// Function to compute the slots for a day
async function computeSlotsForDay(pool, { employeeId, date, durationMinutes, excludeAppointmentId = null }) {
  const startMin = timeToMinutes(DEFAULT_DAY_START); // Convert the default day start to minutes
  const endMin = timeToMinutes(DEFAULT_DAY_END); // Convert the default day end to minutes
  // Query the existing appointments
  const existing = await pool.query(
    `SELECT time, duration FROM ${APPOINTMENTS_TABLE}
     WHERE employee_id = $1 AND date = $2 AND status IS DISTINCT FROM $3
     AND ($4::int IS NULL OR id IS DISTINCT FROM $4)
     ORDER BY time`,
    [employeeId, date, STATUS_CANCELED, excludeAppointmentId]
  );
  const blocks = []; // Set the blocks to an empty array
  // Loop through the existing appointments
  for (const row of existing.rows) {
    const t = timeToMinutes(row.time); // Convert the time to minutes
    let dur = durationToMinutes(row.duration); // Convert the duration to minutes
    if (dur <= 0) dur = 60; // If the duration is less than or equal to 0, set the duration to 60
    blocks.push([t, t + dur]); // Add the block to the blocks array
  }
  blocks.sort((a, b) => a[0] - b[0]); // Sort the blocks by the start time
  const merged = []; // Set the merged to an empty array
  // Loop through the blocks
  for (const [s, e] of blocks) {
    // If the merged array is not empty and the start time is less than or equal to the end time of the last block, set the end time of the last block to the maximum of the end time of the last block and the end time of the current block
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e); // Set the end time of the last block to the maximum of the end time of the last block and the end time of the current block
    } else {
      merged.push([s, e]); // Add the block to the merged array
    }
  }
  const gaps = []; // Set the gaps to an empty array
  let prevEnd = startMin; // Set the previous end to the start time
  // Loop through the merged blocks
  for (const [s, e] of merged) {
    if (s > prevEnd) gaps.push([prevEnd, s]); // If the start time is greater than the previous end, add the gap to the gaps array
    prevEnd = Math.max(prevEnd, e); // Set the previous end to the maximum of the previous end and the end time of the current block
  }
  if (prevEnd < endMin) gaps.push([prevEnd, endMin]); // If the previous end is less than the end time, add the gap to the gaps array
  const slots = []; // Set the slots to an empty array
  // Loop through the gaps
  for (const [gapStart, gapEnd] of gaps) {
    const gapLen = gapEnd - gapStart; // Calculate the length of the gap
    if (gapLen < durationMinutes) continue; // If the length of the gap is less than the duration, continue
    // Loop through the gap
    for (let t = gapStart; t + durationMinutes <= gapEnd; t += SLOT_STEP_MINUTES) {
      slots.push(minutesToTime(t)); // Add the slot to the slots array
    }
  }
  return slots; // Return the slots
}

// Function to generate the invoice id
function generateInvoiceId(clientName, dateStr) {
  const name = (clientName || 'GU').trim().toUpperCase(); // Convert the client name to uppercase and trim the whitespace
  const parts = name.split(/\s+/).filter(Boolean); // Split the name into parts and filter out the empty parts
  const first = (parts[0] || 'G').charAt(0); // Get the first character of the first part
  const second = parts.length > 1 ? (parts[1].charAt(0)) : (parts[0].length > 1 ? parts[0].charAt(1) : 'U'); // Get the second character of the first part
  const datePart = (dateStr || '').replace(/-/g, '').slice(0, 8) || '00000000'; // Get the date part of the date string
  return `${first}${second}${datePart}`; // Return the invoice id
}
// Define the router
const router = express.Router();

// GET /api/appointments/availability – public or auth; query: date, service_type_id
router.get('/availability', optionalAuth, async (req, res, next) => {
  // Try to get the date and service type id
  try {
    const date = req.query.date; // Get the date from the query
    const serviceTypeId = req.query.service_type_id ? parseInt(req.query.service_type_id, 10) : null; // Get the service type id from the query
    // If the date or service type id is not found, return an error
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceTypeId || Number.isNaN(serviceTypeId)) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) and service_type_id are required' }); // Return an error if the date or service type id is not found
    }
    // Query the service type
    const stResult = await db.pool.query(
      `SELECT id, employee_id, duration_needed FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`, // Query the service type
      [serviceTypeId] // Parameters for the query
    );
    const st = stResult.rows[0]; // Get the service type from the result
    if (!st) return res.status(404).json({ error: 'Service type not found' }); // Return an error if the service type is not found
    const employeeId = st.employee_id; // Get the employee id from the service type
    if (employeeId == null) return res.status(400).json({ error: 'Service type has no assigned employee' }); // Return an error if the service type has no assigned employee
    const durationMinutes = durationToMinutes(st.duration_needed); // Get the duration minutes from the service type
    if (durationMinutes <= 0) return res.status(400).json({ error: 'Service type has no duration' }); // Return an error if the service type has no duration

    const ignoreAppointmentId = req.query.ignore_appointment_id != null && req.query.ignore_appointment_id !== '' // Get the ignore appointment id from the query
      ? parseInt(req.query.ignore_appointment_id, 10) // Convert the ignore appointment id to an integer
      : null; // If the ignore appointment id is not found, return null
    const ignoreId = ignoreAppointmentId != null && !Number.isNaN(ignoreAppointmentId) ? ignoreAppointmentId : null; // If the ignore appointment id is not found, return null
    // Compute the slots for the day
    const slots = await computeSlotsForDay(db.pool, {
      employeeId, // Employee id
      date, // Date
      durationMinutes, // Duration minutes
      excludeAppointmentId: ignoreId, // Exclude appointment id
    });
    res.json({ slots }); // Return the slots
  } catch (err) {
    console.error('[Appointments] GET /availability error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// GET /api/appointments – list (auth, admin sees all)
// Query: date_from, date_to, employee_id, status, exclude_paid_invoice (1/true = hide appointments whose invoice is paid)
router.get('/', requireAuth, async (req, res, next) => {
  // Try to get the date from, date to, employee id, status, and exclude paid invoice
  try {
    const staff = isStaffRole(req.user); // Check if the user is a staff role
    const { date_from, date_to, employee_id, status, exclude_paid_invoice } = req.query; // Get the date from, date to, employee id, status, and exclude paid invoice from the query
    const excludePaid = exclude_paid_invoice === '1' || String(exclude_paid_invoice).toLowerCase() === 'true'; // Check if the exclude paid invoice is true
    const tableAlias = 'a'; // Set the table alias to 'a'
    let query = `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE 1=1`; // Set the query to the appointment select from joins and joins
    const params = []; // Set the params to an empty array
    let idx = 1; // Set the index to 1
    // If the user is not a staff role, add the client id and created by to the query
    if (!staff) {
      query += ` AND (${tableAlias}.client_id = $${idx} OR ${tableAlias}.created_by = $${idx})`; // Add the client id and created by to the query
      params.push(req.user.id); // Add the user id to the params
      idx += 1; // Increment the index
    }
    // If the date from is not null and the date from is a valid date, add the date from to the query
    if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      query += ` AND ${tableAlias}.date >= $${idx++}`; // Add the date from to the query
      params.push(date_from); // Add the date from to the params
    }
    // If the date to is not null and the date to is a valid date, add the date to to the query
    if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      query += ` AND ${tableAlias}.date <= $${idx++}`; // Add the date to to the query
      params.push(date_to); // Add the date to to the params
    }
    // If the employee id is not null and the employee id is a valid employee id, add the employee id to the query
    if (employee_id != null && employee_id !== '') {
      const eid = parseInt(employee_id, 10); // Convert the employee id to an integer
      // If the employee id is not a number, add the employee id to the query
      if (!Number.isNaN(eid)) {
        query += ` AND ${tableAlias}.employee_id = $${idx++}`; // Add the employee id to the query
        params.push(eid); // Add the employee id to the params
      }
    }
    // If the status is not null and the status is not an empty string, add the status to the query
    if (status && status !== '') {
      query += ` AND ${tableAlias}.status = $${idx++}`; // Add the status to the query
      params.push(String(status).trim()); // Add the status to the params
    }
    // If the exclude paid is true, add the exclude paid to the query
    if (excludePaid) {
      query += ` AND (i.id IS NULL OR i.payment_status IS DISTINCT FROM 'Paid')`; // Add the exclude paid to the query
    }
    query += ` ORDER BY ${tableAlias}.date ASC, ${tableAlias}.time ASC`; // Add the order by to the query
    const result = await db.pool.query(query, params); // Query the appointments
    res.json({ appointments: result.rows.map(rowToAppointment) }); // Return the appointments
  } catch (err) {
    console.error('[Appointments] GET / error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// GET /api/appointments/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  // Try to get the id
  try {
    const id = parseInt(req.params.id, 10); // Convert the id to an integer
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Return an error if the id is not a number
    // Query the appointment
    const result = await db.pool.query(
      `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE a.id = $1`, // Query the appointment
      [id] // Parameters for the query
    );
    const row = result.rows[0]; // Get the appointment from the result
    if (!row) return res.status(404).json({ error: 'Appointment not found' }); // Return an error if the appointment is not found
    const staff = isStaffRole(req.user); // Check if the user is a staff role
    // Check if the user is the owner of the appointment
    const owner =
      row.client_id === req.user.id || // Check if the user is the client of the appointment
      row.created_by === req.user.id || // Check if the user is the creator of the appointment
      row.employee_id === req.user.id; // Check if the user is the employee of the appointment
    // If the user is not a staff role and not the owner of the appointment, return an error
    if (!staff && !owner) {
      return res.status(403).json({ error: 'Forbidden' }); // Return an error if the user is not a staff role and not the owner of the appointment
    }
    res.json(rowToAppointment(row)); // Return the appointment
  } catch (err) {
    console.error('[Appointments] GET /:id error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// POST /api/appointments – create (optional auth; admin can set status Confirmed)
router.post('/', optionalAuth, async (req, res, next) => {
  // Try to create the appointment
  try {
    const body = req.body || {}; // Get the body from the request
    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : ''; // Get the client name from the body
    const clientEmail = body.client_email != null ? String(body.client_email).trim() : null; // Get the client email from the body
    const clientPhone = body.client_phone != null ? String(body.client_phone).trim() : null; // Get the client phone from the body
    if (!clientName) return res.status(400).json({ error: 'client_name is required' }); // Return an error if the client name is not set
    if (!clientEmail && !clientPhone) return res.status(400).json({ error: 'At least one of client_email or client_phone is required' }); // Return an error if the client email or client phone is not set
    const employeeId = body.employee_id != null ? parseInt(body.employee_id, 10) : null; // Get the employee id from the body
    const serviceTypeId = body.service_type_id != null ? parseInt(body.service_type_id, 10) : null; // Get the service type id from the body
    const date = typeof body.date === 'string' ? body.date.trim() : null; // Get the date from the body
    const time = typeof body.time === 'string' ? body.time.trim() : null; // Get the time from the body
    const description = body.description != null ? String(body.description).trim() : null; // Get the description from the body
    if (!employeeId || Number.isNaN(employeeId)) return res.status(400).json({ error: 'employee_id is required' }); // Return an error if the employee id is not set
    if (!serviceTypeId || Number.isNaN(serviceTypeId)) return res.status(400).json({ error: 'service_type_id is required' }); // Return an error if the service type id is not set
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' }); // Return an error if the date is not set
    if (!time) return res.status(400).json({ error: 'time is required' }); // Return an error if the time is not set
    if (!description) return res.status(400).json({ error: 'description is required' }); // Return an error if the description is not set

    const staff = isStaffRole(req.user); // Check if the user is a staff role
    const status = staff ? STATUS_CONFIRMED : STATUS_PENDING; // Set the status to the status of the user
    const createdBy = req.user ? req.user.id : null; // Get the created by from the user
    const clientId = body.client_id != null && body.client_id !== '' ? parseInt(body.client_id, 10) : null; // Get the client id from the body
    const validClientId = Number.isNaN(clientId) ? null : clientId; // Set the valid client id to the client id if the client id is not a number
    let inspoPics = body.inspo_pics; // Get the inspo pics from the body
    if (inspoPics != null && !Array.isArray(inspoPics)) inspoPics = [inspoPics]; // If the inspo pics is not an array, convert it to an array
    if (inspoPics != null && inspoPics.length === 0) inspoPics = null; // If the inspo pics is not an array, set the inspo pics to null

    // Query the service type
    const stResult = await db.pool.query(
      `SELECT id, employee_id, title, duration_needed, price FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`,
      [serviceTypeId] // Parameters for the query
    );
    const st = stResult.rows[0]; // Get the service type from the result
    if (!st) return res.status(404).json({ error: 'Service type not found' }); // Return an error if the service type is not found
    if (st.employee_id !== employeeId) return res.status(400).json({ error: 'Service type does not belong to this employee' }); // Return an error if the service type does not belong to the employee
    const durationInterval = st.duration_needed; // Get the duration interval from the service type
    const price = st.price != null ? Number(st.price) : 0; // Get the price from the service type
    const serviceTitle = st.title || 'Service'; // Get the service title from the service type

    const client = await db.pool.connect(); // Connect to the database
    const run = (q, p) => client.query(q, p); // Run the query
    const commit = () => client.release(); // Commit the transaction
    const rollback = () => { client.query('ROLLBACK').catch(() => {}); client.release(); }; // Rollback the transaction

    // Try to create the appointment
    try {
      await client.query('BEGIN'); // Begin the transaction
      const now = new Date(); // Get the current date
      const confirmedAt = staff ? now : null; // Set the confirmed at to the current date if the user is a staff role
      // Insert the appointment
      const appResult = await run(
        `INSERT INTO ${APPOINTMENTS_TABLE} (
          client_id, client_name, client_email, client_phone, employee_id, date, time, description, inspo_pics, status, created_by, created_at, updated_at, duration, service_type_id, confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13::interval, $14, $15)
        RETURNING id, invoice_id`,
        [validClientId, clientName, clientEmail, clientPhone, employeeId, date, time, description, inspoPics, status, createdBy, now, durationInterval, serviceTypeId, confirmedAt]
      );
      const appointment = appResult.rows[0]; // Get the appointment from the result
      const appointmentId = appointment.id; // Get the appointment id from the appointment
      const prefix = generateInvoiceId(clientName, date); // Generate the invoice id
      // Query the count of the invoices
      const countResult = await run(
        `SELECT COUNT(*) AS c FROM ${INVOICES_TABLE} WHERE invoice_id LIKE $1`,
        [prefix + '%']
      );
      const n = (parseInt(countResult.rows[0].c, 10) || 0) + 1; // Get the count of the invoices
      const humanInvoiceId = `${prefix}-${n}`; // Generate the human invoice id

      // Insert the invoice
      const invResult = await run(
        `INSERT INTO ${INVOICES_TABLE} (
          invoice_id, customer_id, name, email, phone, created_by, total_amount, currency, payment_status, payment_method, created_at, updated_at, appointment_id, service_title
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13)
        RETURNING id`,
        [humanInvoiceId, validClientId, clientName, clientEmail || '', clientPhone || '', createdBy, price, DEFAULT_CURRENCY, 'Pending', DEFAULT_PAYMENT_METHOD, now, appointmentId, serviceTitle]
      );
      const invoiceId = invResult.rows[0].id; // Get the invoice id from the result
      // Update the appointment
      await run(
        `UPDATE ${APPOINTMENTS_TABLE} SET invoice_id = $1, updated_at = $2 WHERE id = $3`,
        [invoiceId, now, appointmentId]
      );

      await client.query('COMMIT'); // Commit the transaction
      commit(); // Commit the transaction

      // Query the appointment
      const fullApp = await db.pool.query(
        `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE a.id = $1`, // Query the appointment
        [appointmentId] // Parameters for the query
      );
      res.status(201).json(rowToAppointment(fullApp.rows[0])); // Return the appointment
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      rollback(); // Rollback the transaction
      throw txErr; // Throw the error
    }
  } catch (err) {
    console.error('[Appointments] POST / error', err); // Log the error 
    return next(err); // Pass the error to the Express error handler
  }
});

// POST /api/appointments/:id/finished-photo – one file on disk; path appended to completed_photos and the same path inserted into portfolio_photos (single image, two references).
router.post(
  '/:id/finished-photo', // Route for the finished photo
  requireAuth, // Require authentication
  requireAdminOrIT, // Require admin or IT role
  appointmentCompletedPhotoUpload.single('photo'), // Upload the photo
  async (req, res, next) => {
    // Try to get the id
    const id = parseInt(req.params.id, 10); // Parse appointment id from the URL
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Reject non-numeric id
    if (!req.file) return res.status(400).json({ error: 'No image file provided. Use multipart field "photo".' }); // Require uploaded file

    const relativePath = path.posix.join('appointments', 'completedapt', req.file.filename); // Stable URL path stored in DB
    const filePath = req.file.path; // Absolute path on disk for cleanup on failure
    const client = await db.pool.connect(); // Dedicated client for transaction
    // Try to create the finished photo
    try {
      // Begin the transaction
      await client.query('BEGIN'); // Start transaction
      // Query the appointment
      const lockRes = await client.query(
        `SELECT id, employee_id, status, completed_photos FROM ${APPOINTMENTS_TABLE} WHERE id = $1 FOR UPDATE`, // Query the appointment
        [id] // Parameters for the query
      );
      const app = lockRes.rows[0]; // Locked appointment row
      // If the appointment is not found, return an error
      if (!app) {
        await client.query('ROLLBACK'); // Abort transaction
        try {
          fs.unlinkSync(filePath); // Remove orphan upload
        } catch (_) {}
        return res.status(404).json({ error: 'Appointment not found' }); // If the appointment is not found, return an error
      }
      const st = String(app.status || '').trim(); // Current status string
      // If the status is canceled, return an error
      if (st === STATUS_CANCELED) {
        await client.query('ROLLBACK'); // Abort transaction
        // Try to remove the upload
        try {
          fs.unlinkSync(filePath); // Remove upload we will not reference
        } catch (_) {} 
        return res.status(400).json({ error: 'Cannot add photos to a canceled appointment' }); // If the status is canceled, return an error
      }
      // Query the portfolio
      const portfolioResult = await client.query(
        `SELECT id FROM ${PORTFOLIOS_TABLE} WHERE employee_id = $1`, // Query the portfolio
        [app.employee_id] // Parameters for the query
      );
      const portfolio = portfolioResult.rows[0]; // Employee’s portfolio row
      // If the portfolio is not found, return an error
      if (!portfolio) {
        await client.query('ROLLBACK'); // Abort transaction
        // Try to remove the upload
        try {
          fs.unlinkSync(filePath); // Remove upload; no portfolio to attach to
        } catch (_) {}
        return res.status(400).json({ error: 'No portfolio found for this appointment employee. Create a portfolio first.' });
      }

      let existing = []; // Prior completed photo paths
      if (Array.isArray(app.completed_photos)) existing = app.completed_photos.map(String); // Normalize array elements to strings
      else if (app.completed_photos != null) existing = [String(app.completed_photos)]; // Single value to array
      const nextCompleted = [...existing, relativePath]; // Append new relative path
      const now = new Date(); // Timestamp for updated_at and portfolio row
      // Update the appointment
      await client.query(
        `UPDATE ${APPOINTMENTS_TABLE} SET completed_photos = $1, updated_at = $2 WHERE id = $3`,
        [nextCompleted, now, id] // Parameters for the query
      );
      // Query the max order
      const maxOrder = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${PORTFOLIO_PHOTOS_TABLE} WHERE portfolio_id = $1`,
        [portfolio.id] // Parameters for the query
      );
      const sortOrder = maxOrder.rows[0]?.next_order ?? 0; // Next sort_order for new portfolio photo
      // Insert the portfolio photo
      await client.query(
        `INSERT INTO ${PORTFOLIO_PHOTOS_TABLE} (portfolio_id, url, caption, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [portfolio.id, relativePath, `After appointment #${id}`, sortOrder, now]
      );
 
      await client.query('COMMIT'); // Persist appointment and portfolio photo
      // Query the appointment
      const sel = await db.pool.query(
        `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE a.id = $1`,
        [id] // Parameters for the query
      );
      res.status(201).json({ photo: relativePath, appointment: rowToAppointment(sel.rows[0]) }); // Return new path and full appointment
    } catch (err) {
      // Try to rollback the transaction
      try {
        await client.query('ROLLBACK'); // Revert on any error
      } catch (_) {}
      // Try to remove the upload
      try {
        fs.unlinkSync(filePath); // Do not leave uploaded file if DB failed
      } catch (_) {}
      console.error('[Appointments] POST /:id/finished-photo error', err); // Log the error
      return next(err); // Pass the error to the Express error handler
    } finally {
      client.release(); // Return pool connection
    }
  }
);

// PUT /api/appointments/:id – staff full update + workflow status; clients may update inspo_pics, date, time, description
router.put('/:id', requireAuth, async (req, res, next) => {
  // Try to update the appointment
  try {
    const id = parseInt(req.params.id, 10); // Parse appointment id from the URL
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Reject non-numeric id
    const body = req.body || {}; // Request body with optional fields
    // Query the appointment
    const existing = await db.pool.query(
      `SELECT id, client_id, created_by, employee_id, service_type_id, date, time, duration, status, invoice_id
       FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0]; // Current appointment snapshot
    if (!row) return res.status(404).json({ error: 'Appointment not found' }); // Not found

    const staff = isStaffRole(req.user); // Whether caller is admin/it
    const owner = row.client_id === req.user.id || row.created_by === req.user.id; // Client-side owner
    if (!staff && !owner) return res.status(403).json({ error: 'Forbidden' }); // Neither staff nor owner

    const allowedOwner = ['inspo_pics', 'date', 'time', 'description']; // Fields non-staff may change
    if (!staff) {
      const badKeys = Object.keys(body).filter((k) => body[k] !== undefined && !allowedOwner.includes(k)); // Disallowed keys for clients
      if (badKeys.length) {
        return res.status(403).json({ error: 'You may only update inspiration photos, date, time, or notes.' });
      }
    }

    const nextDate = body.date !== undefined ? String(body.date).trim() : pgDateStr(row.date); // Effective date after update
    const nextTimeRaw = body.time !== undefined ? String(body.time).trim() : row.time; // Effective time string after update
    const nextServiceId = body.service_type_id !== undefined ? parseInt(body.service_type_id, 10) : row.service_type_id; // Effective service type id
    const nextEmpId = body.employee_id !== undefined ? parseInt(body.employee_id, 10) : row.employee_id; // Effective employee id
    // Check if the slot is needed
    const needSlotCheck =
      body.date !== undefined || // If the date is not undefined
      body.time !== undefined || // If the time is not undefined
      (staff && (body.service_type_id !== undefined || body.employee_id !== undefined)); // Recompute availability when schedule or assignee changes
    // If the slot is needed, check if the slot is available
    if (needSlotCheck) {
      const stRes = await db.pool.query(
        `SELECT duration_needed FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`,
        [nextServiceId]
      );
      const durMin = durationToMinutes(stRes.rows[0]?.duration_needed) || durationToMinutes(row.duration) || 60; // Minutes needed for slot check
      // Compute the slots for the day
      const slots = await computeSlotsForDay(db.pool, {
        employeeId: nextEmpId, // Employee id
        date: nextDate, // Date
        durationMinutes: durMin, // Duration minutes
        excludeAppointmentId: id, // Exclude appointment id
      });
      const timeNorm = timeSlotKey(nextTimeRaw); // Normalized slot key for chosen time
      const slotKeys = new Set(slots.map((s) => timeSlotKey(s))); // Available slot keys
      // If the slot is not available, return an error
      if (!slotKeys.has(timeNorm)) {
        return res.status(400).json({ error: 'Selected time is not available' }); // If the slot is not available, return an error
      }
    }

    const updates = []; // SQL SET fragments
    const values = []; // Bound values for placeholders
    let idx = 1; // Next $n index
    const now = new Date(); // Now for timestamps
    const set = (col, val) => { updates.push(`${col} = $${idx++}`); values.push(val); }; // Append one column update

    let touchTextFields = false; // Whether to bump updated_at for client-visible edits

    const prevD = pgDateStr(row.date); // Previous date key
    const prevT = timeSlotKey(row.time); // Previous time key
    const nextD = body.date !== undefined ? String(body.date).trim() : prevD; // New date key if changing
    const nextT = body.time !== undefined ? timeSlotKey(body.time) : prevT; // New time key if changing
    // If the date or time is changing, record the reschedule
    if (body.date !== undefined || body.time !== undefined) {
      // If the date or time is actually changing, record the reschedule
      if (nextD !== prevD || nextT !== prevT) {
        set('rescheduled_at', now); // Record reschedule when date or time actually changes
      }
    }

    // If the staff is updating the status
    if (staff && body.status !== undefined) {
      const nextStatusRaw = String(body.status).trim(); // Requested next status
      // Try to assert the staff status transition
      try {
        assertStaffStatusTransition(row.status, nextStatusRaw); // Enforce one-step workflow (not Paid here)
      } catch (e) {
        return res.status(e.statusCode || 400).json({ error: e.message }); // If the status transition is invalid, return an error
      }
      const canon = normalizeApptStatus(nextStatusRaw); // Canonical status for timestamp rules
      set('status', nextStatusRaw); // Persist raw status string
      if (canon === STATUS_CONFIRMED) set('confirmed_at', now); // Record the confirmed at timestamp
      if (canon === STATUS_CHECKED_IN) set('checked_in_at', now); // Record the checked in at timestamp
      if (canon === STATUS_IN_PROGRESS) set('in_progress_at', now); // Record the in progress at timestamp
      if (canon === STATUS_COMPLETE) set('completed_at', now); // Record the completed at timestamp
    }

    // If the staff is updating the appointment
    if (staff) {
      // If the client name is changing, set the client name
      if (body.client_name !== undefined) {
        set('client_name', String(body.client_name).trim()); // Set the client name
        touchTextFields = true; // Touch the text fields
      }
      // If the client email is changing, set the client email
      if (body.client_email !== undefined) {
        set('client_email', body.client_email == null ? null : String(body.client_email).trim()); // Set the client email
        touchTextFields = true; // Touch the text fields
      }
      // If the client phone is changing, set the client phone
      if (body.client_phone !== undefined) {
        set('client_phone', body.client_phone == null ? null : String(body.client_phone).trim()); // Set the client phone
        touchTextFields = true; // Touch the text fields
      }
      if (body.client_id !== undefined) set('client_id', body.client_id == null || body.client_id === '' ? null : parseInt(body.client_id, 10)); // Set the client id
      if (body.employee_id !== undefined) set('employee_id', nextEmpId); // Set the employee id
      // If the service type id is changing, set the service type id
      if (body.service_type_id !== undefined) {
        set('service_type_id', nextServiceId); // Set the service type id
        // Query the service type
        const stRes = await db.pool.query(
          `SELECT duration_needed, title, price FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`, // Query the service type
          [nextServiceId] // Parameters for the query
        );
        if (stRes.rows[0]) set('duration', stRes.rows[0].duration_needed); // Keep appointment duration in sync with service type
      }
      // If the date is changing, set the date
      if (body.date !== undefined) set('date', nextDate);
      // If the time is changing, set the time
      if (body.time !== undefined) set('time', nextTimeRaw);
      // If the description is changing, set the description
      if (body.description !== undefined) {
        set('description', String(body.description).trim()); // Set the description
        touchTextFields = true; // Touch the text fields
      }
      // If the inspiration pictures are changing, set the inspiration pictures
      if (body.inspo_pics !== undefined) {
        set('inspo_pics', Array.isArray(body.inspo_pics) ? body.inspo_pics : null); // Set the inspiration pictures
        touchTextFields = true; // Touch the text fields
      }
    } else {
      // If the description is changing, set the description
      if (body.description !== undefined) {
        set('description', String(body.description).trim()); // Set the description
        touchTextFields = true; // Touch the text fields
      }
      if (body.date !== undefined) set('date', nextDate); // If the date is changing, set the date
      if (body.time !== undefined) set('time', nextTimeRaw); // If the time is changing, set the time
      // If the inspiration pictures are changing, set the inspiration pictures
      if (body.inspo_pics !== undefined) {
        set('inspo_pics', Array.isArray(body.inspo_pics) ? body.inspo_pics : null); // Set the inspiration pictures
        touchTextFields = true; // Touch the text fields
      }
    }

    // If the text fields are touched, bump the updated_at
    if (touchTextFields) {
      set('updated_at', now); // Bump when client or staff changed descriptive fields
    }

    // If the updates are empty, return the current joined row
    if (updates.length === 0) {
      const sel = await db.pool.query(
        `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE a.id = $1`,
        [id]
      );
      return res.json(rowToAppointment(sel.rows[0])); // No-op: return current joined row
    }

    values.push(id); // WHERE id = $last
    // Update the appointment
    await db.pool.query(
      `UPDATE ${APPOINTMENTS_TABLE} SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // If the staff is updating the service type and the invoice id is not null
    if (staff && body.service_type_id !== undefined && row.invoice_id != null) {
      // Query the service type
      const stRow = await db.pool.query(
        `SELECT title, price FROM ${SERVICE_TYPE_TABLE} WHERE id = $1`,
        [nextServiceId]
      );
      const st = stRow.rows[0]; // New service type row for invoice sync
      // If the service type is found, update the invoice
      if (st) {
        const price = st.price != null ? Number(st.price) : 0; // Get the price from the service type
        // Update the invoice
        await db.pool.query(
          `UPDATE ${INVOICES_TABLE} SET service_title = $1, total_amount = $2, updated_at = $3 WHERE id = $4`,
          [st.title || 'Service', price, now, row.invoice_id]
        ).catch(() => {}); // Best-effort invoice line sync; ignore failures
      }
    }

    // Query the appointment
    const sel = await db.pool.query(
      `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE a.id = $1`,
      [id]
    );
    res.json(rowToAppointment(sel.rows[0])); // Return updated appointment with joins
  } catch (err) {
    console.error('[Appointments] PUT /:id error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// PATCH /api/appointments/:id/cancel – staff or booking owner; set appointment and invoice to canceled (no delete)
router.patch('/:id/cancel', requireAuth, async (req, res, next) => {
  // Try to cancel the appointment
  try {
    const id = parseInt(req.params.id, 10); // Parse appointment id from the URL
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Reject non-numeric id
    // Query the appointment
    const existing = await db.pool.query(
      `SELECT id, invoice_id, client_id, created_by FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0]; // Row for auth and invoice link
    if (!row) return res.status(404).json({ error: 'Appointment not found' }); // Not found
    const staff = isStaffRole(req.user); // Whether caller is admin/it
    const owner = row.client_id === req.user.id || row.created_by === req.user.id; // Client-side owner
    if (!staff && !owner) return res.status(403).json({ error: 'Forbidden' }); // Neither staff nor owner
    const now = new Date(); // canceled_at and invoice updated_at
    // Update the appointment
    await db.pool.query(
      `UPDATE ${APPOINTMENTS_TABLE} SET status = $1, canceled_at = $2 WHERE id = $3`,
      [STATUS_CANCELED, now, id]
    );
    // If the invoice id is not null, update the invoice
    if (row.invoice_id != null) {
      // Update the invoice
      await db.pool.query(
        `UPDATE ${INVOICES_TABLE} SET payment_status = $1, updated_at = $2 WHERE id = $3`,
        [STATUS_CANCELED, now, row.invoice_id]
      ); // Mirror canceled state on linked invoice
    }
    // Query the appointment
    const updated = await db.pool.query(
      `SELECT ${appointmentSelectFromJoins()} ${appointmentJoins()} WHERE a.id = $1`,
      [id]
    );
    res.json(rowToAppointment(updated.rows[0])); // Return canceled appointment with joins
  } catch (err) {
    console.error('[Appointments] PATCH /:id/cancel error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

// DELETE /api/appointments/:id – staff; hard delete only when status is already canceled
router.delete('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // Try to delete the appointment
  try {
    const id = parseInt(req.params.id, 10); // Parse appointment id from the URL
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Reject non-numeric id
    // Query the appointment
    const existing = await db.pool.query(
      `SELECT id, invoice_id, status FROM ${APPOINTMENTS_TABLE} WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0]; // Row for guard and FK cleanup
    if (!row) return res.status(404).json({ error: 'Appointment not found' }); // Not found
    const statusNorm = (row.status || '').toLowerCase(); // Compare status case-insensitively
    // If the status is not canceled, return an error
    if (statusNorm !== (STATUS_CANCELED || '').toLowerCase()) {
      return res.status(400).json({ error: 'Can only delete appointments that are already canceled. Cancel the appointment first.' }); // If the status is not canceled, return an error
    }
    await db.pool.query(`UPDATE ${APPOINTMENTS_TABLE} SET invoice_id = NULL WHERE id = $1`, [id]); // Break FK before deleting invoice row
    // If the invoice id is not null, delete the invoice
    if (row.invoice_id != null) {
      await db.pool.query(`DELETE FROM ${INVOICES_TABLE} WHERE appointment_id = $1 OR id = $2`, [id, row.invoice_id]); // Remove invoice linked by id or appointment
    } else {
      await db.pool.query(`DELETE FROM ${INVOICES_TABLE} WHERE appointment_id = $1`, [id]); // Orphan invoice cleanup by appointment_id only
    }
    await db.pool.query(`DELETE FROM ${APPOINTMENTS_TABLE} WHERE id = $1`, [id]); // Remove appointment row
    res.status(204).send(); // No content on success
  } catch (err) {
    console.error('[Appointments] DELETE /:id error', err); // Log the error
    return next(err); // Pass the error to the Express error handler
  }
});

module.exports = router; // Export Express router for app mounting
