/** Aligns with backend `rowToAppointment` + joined invoice / service_type fields on list/detail. */
export interface Appointment {
  id: number;
  client_id: number | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  employee_id: number | null;
  date: string;
  time: string;
  description: string | null;
  inspo_pics: string[] | null;
  completed_photos?: string[] | null;
  status: AppointmentStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  duration: string;
  invoice_id: number | null;
  service_type_id: number | null;
  service_type_title?: string | null;
  confirmed_at?: string | null;
  checked_in_at?: string | null;
  in_progress_at?: string | null;
  completed_at?: string | null;
  paid_at?: string | null;
  canceled_at?: string | null;
  rescheduled_at?: string | null;
  invoice_payment_status?: string | null;
  invoice_total_amount?: number | null;
}

export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked In'
  | 'In Progress'
  | 'Complete'
  | 'Paid'
  | 'Canceled';

export interface ServiceType {
  id: number;
  employee_id: number | null;
  title: string;
  description: string | null;
  duration_needed: string | null;
  price: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentBody {
  client_id?: number | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  employee_id: number;
  date: string;
  time: string;
  description: string;
  inspo_pics?: string[] | null;
  service_type_id: number;
}
