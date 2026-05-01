//Ticket types shared between the frontend and backend to ensure responses match

export type SupportHandlerTeam = 'admin' | 'it'; // Define the support handler team type

//Define the support ticket status type
export type SupportTicketStatus =
  | 'open'
  | 'pending_customer'
  | 'pending_staff'
  | 'resolved'
  | 'closed';

//Define the issue type option interface
export interface IssueTypeOption {
  id: string;
  label: string;
  handler_team: SupportHandlerTeam;
}
//Define the support ticket interface
export interface SupportTicket {
  id: number;
  public_reference: string;
  user_id: number | null;
  guest_email: string | null;
  guest_phone: string | null;
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
//Define the support message interface
export interface SupportMessage {
  id: string;
  author_kind: 'guest' | 'user' | 'staff' | 'system';
  author_user_id: number | null;
  body: string;
  is_internal: boolean;
  created_at: string;
  attachments: { id: number; url: string; mime_type: string | null; created_at: string }[];
}
//Define the guest invoice option interface
export interface GuestInvoiceOption {
  invoice_db_id: number;
  invoice_label: string;
  created_at: string;
  total_amount: number | null;
  appointment_id: number | null;
  payment_status: string | null;
}
