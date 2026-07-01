import type { Metadata } from "next";
import { AppointmentsView } from "@/components/pages/AppointmentsView";

export const metadata: Metadata = { robots: { index: false } };

export default function AppointmentsPage() {
  return <AppointmentsView />;
}
