//Support ticket routes to handle the routes for the support tickets

const crypto = require('crypto'); // crypto module to generate random bytes
const express = require('express'); // express module to create the router
const db = require('../lib/db'); // database connection
const { requireAuth, requireAdminOrIT } = require('../middleware/auth'); // auth middleware to require authentication and admin or IT role
const { supportPhotoUpload } = require('../lib/upload'); // upload middleware to upload photos
const {
  getHandlerTeamForIssue, // function to get the handler team for an issue type
  isValidIssueType, // function to check if an issue type is valid
  listIssueTypesForApi, // function to list the issue types for the api
} = require('../lib/supportTicketConfig');
const {
  statusAfterPublicMessage, // function to get the status after a public message
  insertSystemMessage, // function to insert a system message
  maybeAutoCloseTicket, // function to maybe auto close a ticket
  MSG_CUSTOMER_CLOSE, // message to display when a ticket is closed by the customer
  MSG_STAFF_RESOLVED, // message to display when a ticket is resolved by the staff
  MSG_STAFF_CLOSED, // message to display when a ticket is closed by the staff
} = require('../lib/supportTicketLifecycle');

const router = express.Router(); // create a new router

const T = 'emmasenvy.support_tickets'; // table name for support tickets
const M = 'emmasenvy.support_ticket_messages'; // table name for support ticket messages
const A = 'emmasenvy.support_ticket_attachments'; // table name for support ticket attachments
const APPT = 'emmasenvy.appointments'; // table name for appointments
const INV = 'emmasenvy.invoices'; // table name for invoices

const uploadArray = supportPhotoUpload.array('attachments', 5); // upload array to upload 5 photos

//function to check if a user is a staff user
function isStaffUser(user) {
  if (!user || !user.role) return false; // if the user is not found or the role is not found, return false
  const r = String(user.role).toLowerCase(); // get the role and convert it to lowercase
  return r === 'admin' || r === 'it'; // return true if the role is admin or it, otherwise return false
}

//function to safely rollback a transaction
async function safeRollback(client) {
  // try to rollback the transaction
  try {
    await client.query('ROLLBACK'); // rollback the transaction
  } catch {
    /* no transaction */
  }
}

//function to ensure a unique public reference
async function ensureUniquePublicReference(client) {
  //for each attempt, until 20 attempts, generate a random public reference and check if it is unique
  for (let i = 0; i < 20; i += 1) {
    const ref = `EE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; // generate a random public reference
    const r = await client.query(`SELECT 1 FROM ${T} WHERE public_reference = $1`, [ref]); // check if the public reference is unique
    if (r.rowCount === 0) return ref; // if the public reference is unique, return it
  }
  throw new Error('Could not allocate ticket reference'); // if the public reference is not unique, throw an error
}

//function to assert an appointment for a user
async function assertAppointmentForUser(client, appointmentId, userId) {
  if (appointmentId == null) return true; // if the appointment id is null, return true
  const id = parseInt(appointmentId, 10); // convert the appointment id to an integer
  // if the appointment id is not a number, throw an error
  if (Number.isNaN(id)) {
    const err = new Error('Invalid appointment id'); // create a new error
    err.statusCode = 400; // set the status code to 400
    throw err; // throw the error
  }
  // check if the appointment exists for the user
  const r = await client.query(
    `SELECT id FROM ${APPT} WHERE id = $1 AND (client_id = $2 OR created_by = $2) LIMIT 1`,
    [id, userId]
  );
  // if the appointment does not exist for the user, throw an error
  if (r.rowCount === 0) {
    const err = new Error('Appointment not found'); // create a new error
    err.statusCode = 404; // set the status code to 404
    throw err; // throw the error
  }
  return true;
}

//function to assert an invoice for a user
async function assertInvoiceForUser(client, invoiceId, userId) {
  if (invoiceId == null) return true; // if the invoice id is null, return true
  const id = parseInt(invoiceId, 10); // convert the invoice id to an integer
  // if the invoice id is not a number, throw an error
  if (Number.isNaN(id)) {
    const err = new Error('Invalid invoice id'); // create a new error
    err.statusCode = 400; // set the status code to 400
    throw err; // throw the error
  }
  const r = await client.query(`SELECT id FROM ${INV} WHERE id = $1 AND customer_id = $2 LIMIT 1`, [id, userId]); // check if the invoice exists for the user
  // if the invoice does not exist for the user, throw an error
  if (r.rowCount === 0) {
    const err = new Error('Invoice not found'); // create a new error
    err.statusCode = 404; // set the status code to 404
    throw err; // throw the error
  }
  return true;
}

//function to insert attachments for a message
async function insertAttachments(client, messageId, files) {
  if (!files || !files.length) return; // if the files are not found or the length is 0, return
  // for each file, insert the attachment into the database
  for (const file of files) {
    const rel = `support/${file.filename}`; // create a relative path for the file
    await client.query(`INSERT INTO ${A} (message_id, file_path, mime_type) VALUES ($1, $2, $3)`, [
      messageId, // insert the message id
      rel, // insert the relative path for the file
      file.mimetype || null, // insert the mime type for the file
    ]);
  }
}

//function to load messages for a ticket
async function loadMessagesForTicket(client, ticketId, includeInternal) {
  // load the messages for the ticket
  const msgResult = await client.query(
    `SELECT id, ticket_id, author_kind, author_user_id, body, is_internal, created_at
     FROM ${M}
     WHERE ticket_id = $1
     ORDER BY created_at ASC`,
    [ticketId]
  );
  const rows = includeInternal ? msgResult.rows : msgResult.rows.filter((m) => !m.is_internal); // if internal messages are included, return the rows, otherwise return the rows that are not internal
  const ids = rows.map((r) => r.id); // map the rows to the ids
  let attMap = new Map(); // create a new map for the attachments
  // if the ids are not empty, load the attachments for the messages
  if (ids.length) {
    // load the attachments for the messages
    const att = await client.query(
      `SELECT id, message_id, file_path, mime_type, created_at FROM ${A} WHERE message_id = ANY($1::bigint[])`,
      [ids]
    );
    // for each row, add the attachment to the map
    for (const row of att.rows) {
      if (!attMap.has(row.message_id)) attMap.set(row.message_id, []); // if the message id is not in the map, add an empty array
      // add the attachment to the map
      attMap.get(row.message_id).push({
        id: row.id, // insert the id
        url: `/uploads/${row.file_path}`, // insert the url for the file
        mime_type: row.mime_type, // insert the mime type for the file
        created_at: row.created_at, // insert the created at for the file
      });
    }
  }
  // return the rows mapped to the ids
  return rows.map((m) => ({
    id: String(m.id), // insert the id
    author_kind: m.author_kind, // insert the author kind
    author_user_id: m.author_user_id, // insert the author user id
    body: m.body, // insert the body
    is_internal: includeInternal ? m.is_internal : false, // insert the internal flag
    created_at: m.created_at, // insert the created at
    attachments: attMap.get(m.id) || [], // insert the attachments
  }));
}

//function to try to auto close a ticket by id
async function tryAutoCloseTicketById(pool, ticketId) {
  const client = await pool.connect(); // connect to the pool
  // try to auto close the ticket
  try {
    await client.query('BEGIN'); // begin a transaction
    await maybeAutoCloseTicket(client, ticketId); // auto close the ticket
    await client.query('COMMIT'); // commit the transaction
  } catch (e) {
    // try to rollback the transaction
    try {
      await client.query('ROLLBACK'); // rollback the transaction
    } catch {
      /* ignore */
    }
    console.error('support ticket lazy auto-close', ticketId, e); 
  } finally {
    client.release(); // release the client
  }
}

//function to map a ticket row to a ticket object
function mapTicketRow(row) {
  if (!row) return null; // if the row is not found, return null
  return {
    id: row.id, // insert the id
    public_reference: row.public_reference, // insert the public reference
    user_id: row.user_id, // insert the user id
    subject: row.subject, // insert the subject
    issue_type: row.issue_type, // insert the issue type
    handler_team: row.handler_team, // insert the handler team
    linked_appointment_id: row.linked_appointment_id, // insert the linked appointment id
    linked_invoice_id: row.linked_invoice_id, // insert the linked invoice id
    status: row.status, // insert the status
    priority: row.priority, // insert the priority
    assigned_to_user_id: row.assigned_to_user_id, // insert the assigned to user id
    created_at: row.created_at, // insert the created at
    updated_at: row.updated_at, // insert the updated at
    resolved_at: row.resolved_at, // insert the resolved at
    last_message_at: row.last_message_at, // insert the last message at
  };
}

// --- Public ---
//Route to get the issue types
router.get('/issue-types', (req, res) => {
  res.json({ issue_types: listIssueTypesForApi() }); // return the issue types
});

//Route to get the staff support tickets
router.get('/staff', requireAuth, requireAdminOrIT, async (req, res, next) => {
  // try to get the staff support tickets
  try {
    const status = req.query.status ? String(req.query.status) : null; // get the status
    const handler_team = req.query.handler_team ? String(req.query.handler_team) : null; // get the handler team
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100); // get the limit
    const offset = parseInt(req.query.offset, 10) || 0; // get the offset
    const conds = []; // create an array for the conditions
    const params = []; // create an array for the parameters
    let i = 1; // create a counter
    // if the status is found, add the status to the conditions
    if (status) {
      conds.push(`status = $${i}`); // add the status to the conditions
      params.push(status); // add the status to the parameters
      i += 1; // increment the counter
    }
    // if the handler team is found, add the handler team to the conditions
    if (handler_team === 'admin' || handler_team === 'it') {
      conds.push(`handler_team = $${i}`); // add the handler team to the conditions
      params.push(handler_team); // add the handler team to the parameters
      i += 1; // increment the counter
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''; // create the where clause
    params.push(limit, offset); // add the limit and offset to the parameters
    // get the tickets from the database
    const r = await db.pool.query(
      `SELECT * FROM ${T} ${where} ORDER BY updated_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      params
    );
    res.json({ tickets: r.rows.map(mapTicketRow) }); // return the tickets
  } catch (err) {
    next(err); // next the error
  }
});

// --- Authenticated customer ---
//Route to get the authenticated customer support tickets
router.get('/', requireAuth, async (req, res, next) => {
  // try to get the authenticated customer support tickets
  try {
    // get the tickets from the database
    const r = await db.pool.query(
      `SELECT * FROM ${T} WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json({ tickets: r.rows.map(mapTicketRow) }); // return the tickets
  } catch (err) {
    next(err); // next the error
  }
});

//Route to create a new support ticket for an authenticated customer
router.post('/', requireAuth, uploadArray, async (req, res, next) => {
  const issue_type = req.body.issue_type; // get the issue type
  const subject = (req.body.subject && String(req.body.subject).trim()) || null; // get the subject
  const body = req.body.body != null ? String(req.body.body).trim() : ''; // get the body
  // if the linked appointment id is not found, return an error
  const linked_appointment_id =
    req.body.linked_appointment_id != null && req.body.linked_appointment_id !== ''
      ? parseInt(req.body.linked_appointment_id, 10)
      : null;
  // if the linked invoice id is not found, return an error
  const linked_invoice_id =
    req.body.linked_invoice_id != null && req.body.linked_invoice_id !== ''
      ? parseInt(req.body.linked_invoice_id, 10)
      : null;

  // if the issue type is not valid, return an error
  if (!isValidIssueType(issue_type)) {
    return res.status(400).json({ error: 'Invalid issue_type' }); // return an error
  }
  // if the body is not found, return an error
  if (!body) {
    return res.status(400).json({ error: 'body required' }); // return an error
  }
  const handler_team = getHandlerTeamForIssue(issue_type); // get the handler team for the issue type
  const client = await db.pool.connect(); // connect to the pool
  // try to create the ticket
  try {
    await assertAppointmentForUser(client, linked_appointment_id, req.user.id); // assert the appointment for the user
    await assertInvoiceForUser(client, linked_invoice_id, req.user.id); // assert the invoice for the user
    await client.query('BEGIN'); // begin a transaction
    const public_reference = await ensureUniquePublicReference(client); // ensure a unique public reference
    // insert the ticket into the database
    const ins = await client.query(
      `INSERT INTO ${T} (
        public_reference, user_id, subject, issue_type, handler_team,
        linked_appointment_id, linked_invoice_id, status, last_message_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_staff', NOW(), NOW())
      RETURNING *`,
      [
        public_reference,
        req.user.id,
        subject,
        issue_type,
        handler_team,
        Number.isNaN(linked_appointment_id) ? null : linked_appointment_id,
        Number.isNaN(linked_invoice_id) ? null : linked_invoice_id,
      ]
    );
    const ticket = ins.rows[0]; // get the ticket from the result
    // insert the message into the database
    const msgIns = await client.query(
      `INSERT INTO ${M} (ticket_id, author_kind, author_user_id, body, is_internal)
       VALUES ($1, 'user', $2, $3, false) RETURNING id`,
      [ticket.id, req.user.id, body]
    );
    await insertAttachments(client, msgIns.rows[0].id, req.files); // insert the attachments into the database
    await client.query('COMMIT'); // commit the transaction

    res.status(201).json({ ticket: mapTicketRow(ticket) }); // return the ticket
  } catch (err) {
    await safeRollback(client); // rollback the transaction
    // if the error has a status code, return the error
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message }); // return the error
    }
    next(err); // next the error
  } finally {
    client.release(); // release the client
  }
});

//Route to get a support ticket by id
router.get('/:id', requireAuth, async (req, res, next) => {
  // try to get the support ticket by id
  try {
    const id = parseInt(req.params.id, 10); // get the id
    // if the id is not found, return an error
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' }); // return an error
    }
    await tryAutoCloseTicketById(db.pool, id); // try to auto close the ticket
    const r = await db.pool.query(`SELECT * FROM ${T} WHERE id = $1`, [id]); // get the ticket from the database
    const ticket = r.rows[0]; // get the ticket from the result
    // if the ticket does not exist, return an error
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' }); // return an error
    }
    const staff = isStaffUser(req.user); // check if the user is a staff user
    // if the user is not a staff user and the ticket is not owned by the user, return an error
    if (!staff && ticket.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' }); // return an error
    }
    const messages = await loadMessagesForTicket(db.pool, id, staff); // load the messages for the ticket
    res.json({ ticket: mapTicketRow(ticket), messages }); // return the ticket and messages
  } catch (err) {
    next(err); // next the error
  }
});

//Route to update a support ticket by id
router.patch('/:id', requireAuth, requireAdminOrIT, async (req, res, next) => {
  const id = parseInt(req.params.id, 10); // get the id
  // if the id is not found, return an error
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' }); // return an error
  }
  const VALID_STATUSES = new Set(['open', 'pending_customer', 'pending_staff', 'resolved', 'closed']); // create a set for the valid statuses
  // if the status is not valid, return an error
  if (Object.prototype.hasOwnProperty.call(req.body, 'status') && !VALID_STATUSES.has(String(req.body.status))) {
    return res.status(400).json({ error: 'Invalid status' }); // return an error
  }
  const allowed = ['status', 'priority', 'assigned_to_user_id', 'handler_team', 'linked_appointment_id', 'linked_invoice_id']; // create an array for the allowed fields
  const client = await db.pool.connect(); // connect to the pool
  // try to update the ticket
  try {
    await client.query('BEGIN'); // begin a transaction
    const prevQ = await client.query(`SELECT * FROM ${T} WHERE id = $1 FOR UPDATE`, [id]); // get the previous row from the database
    const prevRow = prevQ.rows[0]; // get the previous row from the result
    // if the previous row does not exist, return an error
    if (!prevRow) {
      await client.query('ROLLBACK'); // rollback the transaction
      return res.status(404).json({ error: 'Ticket not found' }); // return an error
    }
    const updates = []; // create an array for the updates
    const vals = []; // create an array for the values
    let i = 1; // create a counter
    // for each key in the allowed fields, add the key to the updates and values
    for (const key of allowed) {
      // if the key is in the request body, add the key to the updates and values
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates.push(`${key} = $${i}`); // add the key to the updates
        vals.push(req.body[key]); // add the value to the values
        i += 1; // increment the counter
      }
    }
    // if there are no updates, return an error
    if (!updates.length) {
      await client.query('ROLLBACK'); // rollback the transaction
      return res.status(400).json({ error: 'No valid fields' }); // return an error
    }
    updates.push(`updated_at = NOW()`); // add the updated at to the updates
    vals.push(id); // add the id to the values
    const q = `UPDATE ${T} SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`; // create the query
    const r = await client.query(q, vals); // execute the query
    // if the query does not return a row, return an error
    if (!r.rowCount) {
      await client.query('ROLLBACK'); // rollback the transaction
      return res.status(404).json({ error: 'Ticket not found' }); // return an error
    }
    const prevStatus = prevRow.status; // get the previous status
    // if the status is in the request body, update the status
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const ns = req.body.status; // get the new status
      // if the new status is resolved and the previous status is not resolved, insert a system message
      if (ns === 'resolved' && prevStatus !== 'resolved') {
        await insertSystemMessage(client, id, MSG_STAFF_RESOLVED); // insert a system message
      }
      // if the new status is closed and the previous status is not closed, insert a system message
      if (ns === 'closed' && prevStatus !== 'closed') {
        await insertSystemMessage(client, id, MSG_STAFF_CLOSED); // insert a system message
      }
      // if the new status is resolved or closed and the previous status is not the new status, update the resolved at and last message at
      if ((ns === 'resolved' || ns === 'closed') && prevStatus !== ns) {
        // update the resolved at and last message at
        await client.query(
          `UPDATE ${T} SET resolved_at = COALESCE(resolved_at, NOW()), last_message_at = NOW() WHERE id = $1`,
          [id]
        );
      }
    }
    await client.query('COMMIT'); // commit the transaction
    const out = await db.pool.query(`SELECT * FROM ${T} WHERE id = $1`, [id]); // get the ticket from the database
    res.json({ ticket: mapTicketRow(out.rows[0]) }); // return the ticket
  } catch (err) {
    await safeRollback(client); // rollback the transaction
    next(err); // next the error
  } finally {
    client.release(); // release the client
  }
});

//Route to close a support ticket by id
router.post('/:id/close', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10); // get the id
  // if the id is not found, return an error
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' }); // return an error
  }
  const client = await db.pool.connect(); // connect to the pool
  // try to close the ticket
  try {
    await client.query('BEGIN'); // begin a transaction
    const r = await client.query(`SELECT * FROM ${T} WHERE id = $1 FOR UPDATE`, [id]); // get the ticket from the database
    const ticket = r.rows[0]; // get the ticket from the result
    // if the ticket does not exist, return an error
    if (!ticket) {
      await client.query('ROLLBACK'); // rollback the transaction
      return res.status(404).json({ error: 'Ticket not found' }); // return an error
    }
    const isOwner = ticket.user_id != null && ticket.user_id === req.user.id; // check if the user is the owner of the ticket
    // if the user is not the owner of the ticket, return an error
    if (!isOwner) {
      await client.query('ROLLBACK'); // rollback the transaction
      return res.status(403).json({ error: 'Forbidden' }); // return an error
    }
    // if the ticket is already closed, return the ticket
    if (ticket.status === 'closed') {
      await client.query('COMMIT'); // commit the transaction
      return res.json({ ticket: mapTicketRow(ticket) }); // return the ticket
    }
    await insertSystemMessage(client, id, MSG_CUSTOMER_CLOSE); // insert a system message
    // update the ticket status to closed
    await client.query(
      `UPDATE ${T}
       SET status = 'closed', updated_at = NOW(), last_message_at = NOW(),
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT'); // commit the transaction
    const out = await db.pool.query(`SELECT * FROM ${T} WHERE id = $1`, [id]); // get the ticket from the database
    res.json({ ticket: mapTicketRow(out.rows[0]) }); // return the ticket
  } catch (err) {
    await safeRollback(client); // rollback the transaction
    next(err); // next the error
  } finally {
    client.release(); // release the client
  }
});

//Route to add a message to a support ticket by id
router.post('/:id/messages', requireAuth, uploadArray, async (req, res, next) => {
  const id = parseInt(req.params.id, 10); // get the id
  // if the id is not found, return an error
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' }); // return an error
  }
  const body = req.body.body != null ? String(req.body.body).trim() : ''; // get the body
  // if the body is not found, return an error
  if (!body && (!req.files || req.files.length === 0)) {
    return res.status(400).json({ error: 'Message or attachment required' }); // return an error
  }
  const is_internal = req.body.is_internal === true || req.body.is_internal === 'true'; // check if the message is internal
  const client = await db.pool.connect(); // connect to the pool
  // try to add the message to the ticket
  try {
    const r = await client.query(`SELECT * FROM ${T} WHERE id = $1`, [id]); // get the ticket from the database
    const ticket = r.rows[0]; // get the ticket from the result
    // if the ticket does not exist, return an error
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' }); // return an error
    }
    const staff = isStaffUser(req.user); // check if the user is a staff user
    // if the user is not a staff user and the ticket is not owned by the user, return an error
    if (!staff && ticket.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' }); // return an error
    }
    // if the message is internal and the user is not a staff user, return an error
    if (is_internal && !staff) {
      return res.status(403).json({ error: 'Internal notes are staff-only' }); // return an error
    }
    const isTicketRequester = ticket.user_id != null && ticket.user_id === req.user.id; // check if the user is the requester of the ticket
    let author_kind; // create a variable for the author kind
    // if the message is internal and the user is a staff user, set the author kind to staff
    if (is_internal && staff) {
      author_kind = 'staff'; // set the author kind to staff
    } 
    // if the user is a staff user and the ticket is not owned by the user, set the author kind to staff
    else if (staff && !isTicketRequester) {
      author_kind = 'staff'; // set the author kind to staff
    } 
    // if the user is not a staff user and the ticket is owned by the user, set the author kind to user
    else {
      author_kind = 'user'; // set the author kind to user
    }
    await client.query('BEGIN'); // begin a transaction
    const msgBody = body || '(attachment)'; // get the message body
    // insert the message into the database
    const msgIns = await client.query(
      `INSERT INTO ${M} (ticket_id, author_kind, author_user_id, body, is_internal)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, author_kind, req.user.id, msgBody, Boolean(is_internal && staff)]
    );
    await insertAttachments(client, msgIns.rows[0].id, req.files); // insert the attachments into the database
    const customerVisible = !is_internal; // check if the message is customer visible
    // if the message is customer visible, update the ticket status
    if (customerVisible) {
      const nextStatus = statusAfterPublicMessage(author_kind); // get the next status
      // update the ticket status
      await client.query(
        `UPDATE ${T} SET updated_at = NOW(), last_message_at = NOW(), status = $2 WHERE id = $1`,
        [id, nextStatus]
      );
    } 
    // if the message is not customer visible, update the ticket status
    else {
      await client.query(`UPDATE ${T} SET updated_at = NOW() WHERE id = $1`, [id]); // update the ticket status
    }
    await client.query('COMMIT'); // commit the transaction

    const messages = await loadMessagesForTicket(db.pool, id, staff); // load the messages for the ticket
    res.status(201).json({ messages }); // return the messages
  } catch (err) {
    await safeRollback(client); // rollback the transaction
    next(err); // next the error
  } finally {
    client.release(); // release the client
  }
});

module.exports = router;
