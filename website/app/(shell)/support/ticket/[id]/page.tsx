import type { Metadata } from "next";
import { TicketThread } from "@/components/pages/SupportTickets";

export const metadata: Metadata = { robots: { index: false } };

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketThread ticketId={parseInt(id, 10)} />;
}
