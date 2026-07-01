import type { Metadata } from "next";
import { AccountView } from "@/components/pages/AccountView";

export const metadata: Metadata = { robots: { index: false } };

export default function AccountPage() {
  return <AccountView />;
}
