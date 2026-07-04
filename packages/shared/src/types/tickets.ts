export type SupportHandlerTeam = 'admin' | 'it';

export type SupportTicketStatus =
  | 'open'
  | 'pending_customer'
  | 'pending_staff'
  | 'resolved'
  | 'closed';

export interface IssueTypeOption {
  id: string;
  label: string;
  handler_team: SupportHandlerTeam;
}

export interface SupportTicket {
  id: number;
  public_reference: string;
  user_id: number | null;
  subject: string | null;
  issue_type: string;
  handler_team: SupportHandlerTeam;
  linked_appointment_id: number | null;
  linked_invoice_id: number | null;
  status: SupportTicketStatus;
  priority: string;
  assigned_to_user_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_message_at: string | null;
}

export interface SupportMessage {
  id: string;
  author_kind: 'user' | 'staff' | 'system';
  author_user_id: number | null;
  body: string;
  is_internal: boolean;
  created_at: string;
  attachments: { id: number; url: string; mime_type: string | null; created_at: string }[];
}
