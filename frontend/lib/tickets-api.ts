//API calls for the support tickets

import { apiUrl, fetchWithAuth } from '@/lib/api'; // Import the apiUrl and fetchWithAuth functions from the api.ts file
import type {
  GuestInvoiceOption, // Import the guest invoice option type from the ticket-types.ts file
  IssueTypeOption, // Import the issue type option type from the ticket-types.ts file
  SupportMessage, // Import the support message type from the ticket-types.ts file  
  SupportTicket, // Import the support ticket type from the ticket-types.ts file
} from '@/lib/ticket-types';

//Parse the JSON response from the API
async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text(); // Get the text from the response
  // Try to parse the text as JSON
  try {
    return JSON.parse(text) as T; // Parse the text as JSON
  } catch {
    throw new Error(text || res.statusText); // Throw an error if the text is not JSON
  }
}

//Fetch the issue types from the API
export async function fetchIssueTypes(): Promise<IssueTypeOption[]> {
  const res = await fetch(apiUrl('/api/support-tickets/issue-types'), { headers: { Accept: 'application/json' } }); // Fetch the issue types from the API
  const data = await parseJson<{ issue_types?: IssueTypeOption[] }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load issue types'); // Throw an error if the response is not successful
  return data.issue_types || []; // Return the issue types
}

//Fetch the tickets from the API
export async function listMyTickets(token: string): Promise<SupportTicket[]> {
  const res = await fetchWithAuth(apiUrl('/api/support-tickets'), { headers: { Accept: 'application/json' } }, token); // Fetch the tickets from the API
  const data = await parseJson<{ tickets?: SupportTicket[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to load tickets'); // Throw an error if the response is not successful
  return data.tickets || []; // Return the tickets
}

//Fetch the tickets from the API for the staff
export async function listStaffTickets(
  token: string, // Token for the listStaffTickets function
  params?: { status?: string; handler_team?: string; limit?: number; offset?: number } // Params for the listStaffTickets function
): Promise<SupportTicket[]> {
  const q = new URLSearchParams(); // Create a new URLSearchParams object
  if (params?.status) q.set('status', params.status); // Set the status in the query string
  if (params?.handler_team) q.set('handler_team', params.handler_team); // Set the handler team in the query string
  if (params?.limit != null) q.set('limit', String(params.limit)); // Set the limit in the query string
  if (params?.offset != null) q.set('offset', String(params.offset)); // Set the offset in the query string
  const qs = q.toString(); // Get the query string
  const path = qs ? `/api/support-tickets/staff?${qs}` : '/api/support-tickets/staff'; // Get the path for the API
  const res = await fetchWithAuth(apiUrl(path), { headers: { Accept: 'application/json' } }, token); // Fetch the tickets from the API
  const data = await parseJson<{ tickets?: SupportTicket[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to load queue'); // Throw an error if the response is not successful
  return data.tickets || []; // Return the tickets
}

//Fetch the ticket from the API
export async function getTicket(
  token: string, // Token for the getTicket function
  id: number // ID of the ticket to fetch
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  const res = await fetchWithAuth(apiUrl(`/api/support-tickets/${id}`), { headers: { Accept: 'application/json' } }, token); // Fetch the ticket from the API
  const data = await parseJson<{ ticket?: SupportTicket; messages?: SupportMessage[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to load ticket'); // Throw an error if the response is not successful
  return { ticket: data.ticket!, messages: data.messages || [] }; // Return the ticket and messages
}

//Append the images to the form data
function appendImages(fd: FormData, uris: string[] | undefined) {
  if (!uris?.length) return; // If the images are not found, return
  let i = 0; // Initialize the index
  //For each image, append the image to the form data
  for (const uri of uris) {
    if (!uri) continue; // If the image is not found, continue
    const name = `attach-${i++}.jpg`; // Get the name of the image
    fd.append('attachments', { uri, name, type: 'image/jpeg' } as unknown as Blob); // Append the image to the form data
  }
}

//Create a ticket
export async function createTicket(
  token: string, // Token for the createTicket function
  fields: {
    issue_type: string; // Issue type for the createTicket function
    subject?: string; // Subject for the createTicket function
    body: string; // Body for the createTicket function
    linked_appointment_id?: number | null; // Linked appointment id for the createTicket function
    linked_invoice_id?: number | null; // Linked invoice id for the createTicket function
    imageUris?: string[]; // Image URIs for the createTicket function
  }
): Promise<SupportTicket> {
  const fd = new FormData(); // Create a new form data object
  fd.append('issue_type', fields.issue_type); // Append the issue type to the form data
  if (fields.subject) fd.append('subject', fields.subject); // Append the subject to the form data
  fd.append('body', fields.body); // Append the body to the form data
  if (fields.linked_appointment_id != null) { fd.append('linked_appointment_id', String(fields.linked_appointment_id)); } // Append the linked appointment id to the form data
  if (fields.linked_invoice_id != null) { fd.append('linked_invoice_id', String(fields.linked_invoice_id)); } // Append the linked invoice id to the form data
  appendImages(fd, fields.imageUris); // Append the images to the form data
  const res = await fetchWithAuth(apiUrl('/api/support-tickets'), { method: 'POST', body: fd, headers: { Accept: 'application/json' } }, token); // Fetch the ticket from the API
  const data = await parseJson<{ ticket?: SupportTicket; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to create ticket'); // Throw an error if the response is not successful
  return data.ticket!; // Return the ticket
}

//Close a ticket as a customer
export async function closeTicketAsCustomer(token: string, id: number): Promise<SupportTicket> {
  const res = await fetchWithAuth(apiUrl(`/api/support-tickets/${id}/close`), { method: 'POST', headers: { Accept: 'application/json' } }, token); // Fetch the ticket from the API
  const data = await parseJson<{ ticket?: SupportTicket; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to close ticket'); // Throw an error if the response is not successful
  return data.ticket!; // Return the ticket
}

//Patch a ticket as a staff
export async function patchTicketStaff(
  token: string, // Token for the patchTicketStaff function
  id: number, // ID of the ticket to patch
  patch: Partial<{
    status: string; // Status of the ticket to patch
    priority: string; // Priority of the ticket to patch
    assigned_to_user_id: number | null; // Assigned to user id of the ticket to patch
    handler_team: string; // Handler team of the ticket to patch
    linked_appointment_id: number | null; // Linked appointment id of the ticket to patch
    linked_invoice_id: number | null; // Linked invoice id of the ticket to patch
  }>
): Promise<SupportTicket> {
  //Try to patch the ticket
  const res = await fetchWithAuth(
    apiUrl(`/api/support-tickets/${id}`),
    { method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(patch) },
    token
  );
  const data = await parseJson<{ ticket?: SupportTicket; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to update'); // Throw an error if the response is not successful
  return data.ticket!; // Return the ticket
}

//Post a message to a ticket
export async function postTicketMessage(
  token: string, // Token for the postTicketMessage function
  ticketId: number, // ID of the ticket to post the message to
  body: string, // Body of the message to post
  opts?: { is_internal?: boolean; imageUris?: string[] } // Options for the postTicketMessage function
): Promise<SupportMessage[]> {
  const fd = new FormData(); // Create a new form data object
  fd.append('body', body); // Append the body to the form data
  if (opts?.is_internal) fd.append('is_internal', 'true'); // Append the is internal to the form data
  appendImages(fd, opts?.imageUris); // Append the images to the form data
  //Try to post the message to the ticket
  const res = await fetchWithAuth(
    apiUrl(`/api/support-tickets/${ticketId}/messages`), 
    { method: 'POST', body: fd, headers: { Accept: 'application/json' } },
    token
  );
  const data = await parseJson<{ messages?: SupportMessage[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to send message'); // Throw an error if the response is not successful
  return data.messages || []; // Return the messages
}

//Create a ticket as a guest
export async function guestCreateTicket(fields: {
  guest_email?: string; // Guest email for the guestCreateTicket function
  guest_phone?: string; // Guest phone for the guestCreateTicket function
  issue_type: string; // Issue type for the guestCreateTicket function
  subject?: string; // Subject for the guestCreateTicket function
  body: string; // Body for the guestCreateTicket function
  linked_appointment_id?: number | null; // Linked appointment id for the guestCreateTicket function
  linked_invoice_id?: number | null; // Linked invoice id for the guestCreateTicket function
  imageUris?: string[]; // Image URIs for the guestCreateTicket function
}): Promise<{ ticket: SupportTicket; message?: string }> {
  const fd = new FormData(); // Create a new form data object
  if (fields.guest_email) fd.append('guest_email', fields.guest_email); // Append the guest email to the form data
  if (fields.guest_phone) fd.append('guest_phone', fields.guest_phone); // Append the guest phone to the form data
  fd.append('issue_type', fields.issue_type); // Append the issue type to the form data
  if (fields.subject) fd.append('subject', fields.subject); // Append the subject to the form data
  fd.append('body', fields.body); // Append the body to the form data
  if (fields.linked_appointment_id != null) { fd.append('linked_appointment_id', String(fields.linked_appointment_id)); } // Append the linked appointment id to the form data
  if (fields.linked_invoice_id != null) { fd.append('linked_invoice_id', String(fields.linked_invoice_id)); } // Append the linked invoice id to the form data
  appendImages(fd, fields.imageUris); // Append the images to the form data
  //Try to create the ticket as a guest
  const res = await fetch(apiUrl('/api/support-tickets/guest'), {
    method: 'POST', // Set the method to POST
    body: fd, // Set the body to the form data
    headers: { Accept: 'application/json' }, // Set the headers to the form data
  });
  const data = await parseJson<{ ticket?: SupportTicket; message?: string; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to create ticket'); // Throw an error if the response is not successful
  return { ticket: data.ticket!, message: data.message }; // Return the ticket and message
}

//Claim a ticket as a guest
export async function guestClaimTicket(params: {
  public_reference: string; // Public reference for the guestClaimTicket function
  email?: string; // Email for the guestClaimTicket function
  phone?: string; // Phone for the guestClaimTicket function
}): Promise<{ guest_ticket_token: string; ticket: SupportTicket }> {
  //Try to claim the ticket as a guest
  const res = await fetch(apiUrl('/api/support-tickets/guest/claim'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      public_reference: params.public_reference.trim(), // Set the public reference to the trim
      email: params.email?.trim() || undefined, // Set the email to the trim
      phone: params.phone?.trim() || undefined, // Set the phone to the trim
    }),
  });
  const data = await parseJson<{ guest_ticket_token?: string; ticket?: SupportTicket; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Could not open ticket'); // Throw an error if the response is not successful
  return { guest_ticket_token: data.guest_ticket_token!, ticket: data.ticket! }; // Return the guest ticket token and ticket
}

//Get a thread as a guest
export async function guestGetThread(guestToken: string): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  //Try to get the thread as a guest
  const res = await fetch(apiUrl('/api/support-tickets/guest/thread'), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${guestToken}` }, // Set the headers to the form data
  });
  const data = await parseJson<{ ticket?: SupportTicket; messages?: SupportMessage[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to load thread'); // Throw an error if the response is not successful
  return { ticket: data.ticket!, messages: data.messages || [] }; // Return the ticket and messages
}

//Post a message to a ticket as a guest
export async function guestPostMessage(
  guestToken: string, // Token for the guestPostMessage function
  body: string, // Body of the message to post
  imageUris?: string[] // Image URIs for the guestPostMessage function
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  const fd = new FormData(); // Create a new form data object
  fd.append('body', body); // Append the body to the form data
  appendImages(fd, imageUris); // Append the images to the form data
  const res = await fetch(apiUrl('/api/support-tickets/guest/messages'), {
    method: 'POST', // Set the method to POST
    body: fd, // Set the body to the form data
    headers: { Accept: 'application/json', Authorization: `Bearer ${guestToken}` }, // Set the headers to the form data
  });
  const data = await parseJson<{ ticket?: SupportTicket; messages?: SupportMessage[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to send'); // Throw an error if the response is not successful
  return { ticket: data.ticket!, messages: data.messages || [] }; // Return the ticket and messages
}

//Close a ticket as a guest
export async function guestCloseTicket(
  guestToken: string, // Token for the guestCloseTicket function
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  const res = await fetch(apiUrl('/api/support-tickets/guest/close'), {
    method: 'POST', // Set the method to POST
    headers: { Accept: 'application/json', Authorization: `Bearer ${guestToken}` }, // Set the headers to the form data
  });
  const data = await parseJson<{ ticket?: SupportTicket; messages?: SupportMessage[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Failed to close'); // Throw an error if the response is not successful
  return { ticket: data.ticket!, messages: data.messages || [] }; // Return the ticket and messages
}

//Find records as a guest
export async function guestFindRecords(params: { email?: string; phone?: string }): Promise<GuestInvoiceOption[]> {
  const res = await fetch(apiUrl('/api/support-tickets/guest/find-records'), {
    method: 'POST', // Set the method to POST 
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ 
      email: params.email?.trim() || undefined, // Set the email to the trim
      phone: params.phone?.trim() || undefined, // Set the phone to the trim
    }),
  });
  const data = await parseJson<{ options?: GuestInvoiceOption[]; error?: string }>(res); // Parse the response as JSON
  if (!res.ok) throw new Error(data.error || 'Lookup failed'); // Throw an error if the response is not successful  
  return data.options || []; // Return the options
}

//Verify an appointment as a guest
export async function guestVerifyAppointment(params: {
  appointment_id: number; // Appointment id for the guestVerifyAppointment function
  email?: string; // Email for the guestVerifyAppointment function
  phone?: string; // Phone for the guestVerifyAppointment function
}): Promise<{ id: number; date: string; time: string; status: string }> {
  const res = await fetch(apiUrl('/api/support-tickets/guest/verify-appointment'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      appointment_id: params.appointment_id, // Set the appointment id to the trim
      email: params.email?.trim() || undefined, // Set the email to the trim
      phone: params.phone?.trim() || undefined, // Set the phone to the trim
    }),
  });
  //Try to verify the appointment as a guest
  const data = await parseJson<{ appointment?: { id: number; date: string; time: string; status: string }; error?: string }>(
    res
  );
  if (!res.ok) throw new Error(data.error || 'Verification failed'); // Throw an error if the response is not successful
  return data.appointment!; // Return the appointment
}
