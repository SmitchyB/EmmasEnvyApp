export interface DataExportPayload {
  exported_at: string;
  user: {
    id: number;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    dob: string | null;
    created_at: string;
    updated_at: string;
    reward_points: number;
  } | null;
  invoices: {
    invoice_id: string;
    created_at: string;
    total_amount: number;
    currency: string | null;
    payment_status: string | null;
  }[];
}
