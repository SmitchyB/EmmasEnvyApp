import { apiUrl } from '../config';
import { fetchWithAuth } from './client';
import { parseJsonOrThrow } from '../utils/http';
import type {
  IssueTypeOption,
  SupportMessage,
  SupportTicket,
} from '../types/tickets';

async function parseJson<T>(res: Response): Promise<T> {
  return parseJsonOrThrow<T>(res);
}

function appendImages(fd: FormData, uris: string[] | undefined) {
  if (!uris?.length) return;
  let i = 0;
  for (const uri of uris) {
    if (!uri) continue;
    const name = `attach-${i++}.jpg`;
    fd.append('attachments', { uri, name, type: 'image/jpeg' } as unknown as Blob);
  }
}

export async function fetchIssueTypes(): Promise<IssueTypeOption[]> {
  const res = await fetch(apiUrl('/api/support-tickets/issue-types'), { headers: { Accept: 'application/json' } });
  const data = await parseJson<{ issue_types?: IssueTypeOption[] }>(res);
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load issue types');
  return data.issue_types || [];
}

export async function listMyTickets(token: string): Promise<SupportTicket[]> {
  const res = await fetchWithAuth(apiUrl('/api/support-tickets'), { headers: { Accept: 'application/json' } }, token);
  const data = await parseJson<{ tickets?: SupportTicket[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load tickets');
  return data.tickets || [];
}

export async function listStaffTickets(
  token: string,
  params?: { status?: string; handler_team?: string; limit?: number; offset?: number }
): Promise<SupportTicket[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.handler_team) q.set('handler_team', params.handler_team);
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  const path = qs ? `/api/support-tickets/staff?${qs}` : '/api/support-tickets/staff';
  const res = await fetchWithAuth(apiUrl(path), { headers: { Accept: 'application/json' } }, token);
  const data = await parseJson<{ tickets?: SupportTicket[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load queue');
  return data.tickets || [];
}

export async function getTicket(
  token: string,
  id: number
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  const res = await fetchWithAuth(apiUrl(`/api/support-tickets/${id}`), { headers: { Accept: 'application/json' } }, token);
  const data = await parseJson<{ ticket?: SupportTicket; messages?: SupportMessage[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load ticket');
  return { ticket: data.ticket!, messages: data.messages || [] };
}

export async function createTicket(
  token: string,
  fields: {
    issue_type: string;
    subject?: string;
    body: string;
    linked_appointment_id?: number | null;
    linked_invoice_id?: number | null;
    imageUris?: string[];
  }
): Promise<SupportTicket> {
  const fd = new FormData();
  fd.append('issue_type', fields.issue_type);
  if (fields.subject) fd.append('subject', fields.subject);
  fd.append('body', fields.body);
  if (fields.linked_appointment_id != null) fd.append('linked_appointment_id', String(fields.linked_appointment_id));
  if (fields.linked_invoice_id != null) fd.append('linked_invoice_id', String(fields.linked_invoice_id));
  appendImages(fd, fields.imageUris);
  const res = await fetchWithAuth(apiUrl('/api/support-tickets'), { method: 'POST', body: fd, headers: { Accept: 'application/json' } }, token);
  const data = await parseJson<{ ticket?: SupportTicket; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to create ticket');
  return data.ticket!;
}

export async function closeTicketAsCustomer(token: string, id: number): Promise<SupportTicket> {
  const res = await fetchWithAuth(apiUrl(`/api/support-tickets/${id}/close`), { method: 'POST', headers: { Accept: 'application/json' } }, token);
  const data = await parseJson<{ ticket?: SupportTicket; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to close ticket');
  return data.ticket!;
}

export async function patchTicketStaff(
  token: string,
  id: number,
  patch: Partial<{
    status: string;
    priority: string;
    assigned_to_user_id: number | null;
    handler_team: string;
    linked_appointment_id: number | null;
    linked_invoice_id: number | null;
  }>
): Promise<SupportTicket> {
  const res = await fetchWithAuth(
    apiUrl(`/api/support-tickets/${id}`),
    { method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(patch) },
    token
  );
  const data = await parseJson<{ ticket?: SupportTicket; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to update');
  return data.ticket!;
}

export async function postTicketMessage(
  token: string,
  ticketId: number,
  body: string,
  opts?: { is_internal?: boolean; imageUris?: string[] }
): Promise<SupportMessage[]> {
  const fd = new FormData();
  fd.append('body', body);
  if (opts?.is_internal) fd.append('is_internal', 'true');
  appendImages(fd, opts?.imageUris);
  const res = await fetchWithAuth(
    apiUrl(`/api/support-tickets/${ticketId}/messages`),
    { method: 'POST', body: fd, headers: { Accept: 'application/json' } },
    token
  );
  const data = await parseJson<{ messages?: SupportMessage[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to send message');
  return data.messages || [];
}
