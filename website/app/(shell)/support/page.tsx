import type { Metadata } from "next";
import { SupportHub } from "@/components/pages/SupportHub";

export const metadata: Metadata = { robots: { index: false } };

export default function SupportPage() {
  return <SupportHub />;
}
