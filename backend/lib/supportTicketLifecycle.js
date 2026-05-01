//Support ticket lifecycle functions to handle the lifecycle of a support ticket

const T = 'emmasenvy.support_tickets'; // table name for support tickets
const M = 'emmasenvy.support_ticket_messages'; // table name for support ticket messages

const AUTO_CLOSE_DAYS = 30; // number of days to auto close a ticket

//message to display when a ticket is auto closed
const MSG_AUTO_CLOSE =
  'This ticket was closed automatically because we did not hear back within 30 days. If you still need help, reply here or open a new support ticket.';

//message to display when a ticket is closed by the customer
const MSG_CUSTOMER_CLOSE =
  'The customer indicated they no longer need help. This ticket has been closed.';

//message to display when a ticket is resolved by the staff
const MSG_STAFF_RESOLVED =
  'This ticket was marked resolved by staff. Reply here if you still need anything.';

const MSG_STAFF_CLOSED = 'Staff closed this ticket.'; //message to display when a ticket is closed by the staff

//function to safely rollback a transaction
async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* no transaction */
  }
}

//function to get the status after a public message
function statusAfterPublicMessage(authorKind) {
  if (authorKind === 'staff') return 'pending_customer';
  return 'pending_staff';
}

//function to insert a system message
async function insertSystemMessage(client, ticketId, body) {
  await client.query(
    `INSERT INTO ${M} (ticket_id, author_kind, author_user_id, body, is_internal)
     VALUES ($1, 'system', NULL, $2, false)`,
    [ticketId, body]
  );
}

//function to close a ticket with a system message
async function closeTicketWithSystemMessage(client, ticketId, body) {
  await insertSystemMessage(client, ticketId, body);
  await client.query(
    `UPDATE ${T}
     SET status = 'closed', updated_at = NOW(), last_message_at = NOW(),
         resolved_at = COALESCE(resolved_at, NOW())
     WHERE id = $1`,
    [ticketId]
  );
}

//function to close a ticket if it is pending customer and has been inactive for too long
async function maybeAutoCloseTicket(client, ticketId) {
  const r = await client.query(
    `SELECT id FROM ${T}
     WHERE id = $1
       AND status = 'pending_customer'
       AND last_message_at IS NOT NULL
       AND last_message_at < NOW() - ($2 * INTERVAL '1 day')
     FOR UPDATE`,
    [ticketId, AUTO_CLOSE_DAYS]
  );
  if (r.rowCount === 0) return; // if the ticket is not found, return
  await closeTicketWithSystemMessage(client, ticketId, MSG_AUTO_CLOSE); // close the ticket with a system message
}

//function that find all ticket ids where the status is pending customer and has been inactive for too long and auto closes them
async function sweepExpiredPendingCustomer(pool) {
  // find all ticket ids where the status is pending customer and has been inactive for too long
  const r = await pool.query(
    `SELECT id FROM ${T}
     WHERE status = 'pending_customer'
       AND last_message_at IS NOT NULL
       AND last_message_at < NOW() - ($1 * INTERVAL '1 day')`,
    [AUTO_CLOSE_DAYS]
  );
  //for each ticket id, auto close the ticket
  for (const row of r.rows) {
    const client = await pool.connect(); // connect to the pool
    // try to auto close the ticket
    try {
      await client.query('BEGIN'); // begin a transaction
      await maybeAutoCloseTicket(client, row.id); // auto close the ticket
      await client.query('COMMIT'); // commit the transaction
    } catch (e) {
      await safeRollback(client); // rollback the transaction
      console.error('support ticket auto-close sweep', row.id, e); // log the error
    } finally {
      client.release(); // release the client
    }
  }
}


//export the functions
module.exports = {
  AUTO_CLOSE_DAYS,
  MSG_AUTO_CLOSE,
  MSG_CUSTOMER_CLOSE,
  MSG_STAFF_RESOLVED,
  MSG_STAFF_CLOSED,
  statusAfterPublicMessage,
  insertSystemMessage,
  closeTicketWithSystemMessage,
  maybeAutoCloseTicket,
  sweepExpiredPendingCustomer,
  safeRollback,
};
