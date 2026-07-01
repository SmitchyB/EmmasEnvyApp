import type { Metadata } from "next";
import { CreateTicketForm } from "@/components/pages/SupportTickets";
import { SearchParamsSuspense } from "@/components/SearchParamsSuspense";

export const metadata: Metadata = { robots: { index: false } };

export default function SupportCreatePage() {
  return (
    <SearchParamsSuspense>
      <CreateTicketForm />
    </SearchParamsSuspense>
  );
}
