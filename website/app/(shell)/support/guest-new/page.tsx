import type { Metadata } from "next";
import { GuestNewTicketForm } from "@/components/pages/GuestSupport";

export const metadata: Metadata = { robots: { index: false } };

export default function GuestNewPage() {
  return <GuestNewTicketForm />;
}
