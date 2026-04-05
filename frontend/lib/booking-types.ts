/** Aligns with backend `rowToAppointment` + joined invoice / service_type fields on list/detail. */
export interface Appointment {
  id: number; // Primary key from emmasenvy.appointments
  client_id: number | null; // Logged-in customer user id when applicable
  client_name: string; // Display name on booking
  client_email: string | null; // Contact email
  client_phone: string | null; // Contact phone
  employee_id: number | null; // Assigned stylist user id
  date: string; // Calendar date YYYY-MM-DD
  time: string; // Start time HH:MM local wall clock
  description: string | null; // Notes from customer or staff
  inspo_pics: string[] | null; // Inspiration image paths or URIs
  /** Relative paths under /uploads (after-visit photos). */
  completed_photos?: string[] | null;
  status: AppointmentStatus; // Workflow status from appointments_status_check
  created_by: number | null; // User who created the row (walk-in staff, etc.)
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  duration: string; // Interval string copied onto appointment row
  invoice_id: number | null; // Linked invoice when generated
  service_type_id: number | null; // Booked service type
  /** From join to `service_type`; preferred over client-side lookup */
  service_type_title?: string | null;
  confirmed_at?: string | null; // Workflow timestamp
  checked_in_at?: string | null; // Workflow timestamp
  in_progress_at?: string | null; // Workflow timestamp
  completed_at?: string | null; // Workflow timestamp
  paid_at?: string | null; // Set when invoice paid
  canceled_at?: string | null; // Set when canceled
  rescheduled_at?: string | null; // Last reschedule time
  invoice_payment_status?: string | null; // From joined invoices row
  invoice_total_amount?: number | null; // From joined invoices row
}

// Appointment status types
export type AppointmentStatus =
  | 'Pending' // Pending status for the appointment
  | 'Confirmed' // Confirmed status for the appointment
  | 'Checked In' // Checked in status for the appointment
  | 'In Progress' // In progress status for the appointment
  | 'Complete' // Complete status for the appointment
  | 'Paid' // Paid status for the appointment
  | 'Canceled' // Canceled status for the appointment

  //Service Type interface
export interface ServiceType {
  id: number; // Primary key from service_type
  employee_id: number | null; // Stylist who offers this service
  title: string; // Short label shown in booking UI
  description: string | null; // Longer marketing or detail text
  duration_needed: string | null; // Duration needed for the service type
  price: number | null; // Decimal price for POS / display
  tags: string[] | null; // Optional categorization
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// Create Appointment Body interface
export interface CreateAppointmentBody {
  client_id?: number | null; // Optional logged-in client
  client_name: string; // Required name for invoice and display
  client_email: string | null; //Email for the client
  client_phone: string | null; //Phone for the client
  employee_id: number; // Must match service type stylist
  date: string; // YYYY-MM-DD
  time: string; // HH:MM slot key
  description: string; // Notes field (may default to title)
  inspo_pics?: string[] | null; // Optional inspiration paths
  service_type_id: number; // Drives duration and employee
}
