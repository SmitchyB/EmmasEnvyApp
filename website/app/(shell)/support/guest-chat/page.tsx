import type { Metadata } from "next";
import { GuestChatView } from "@/components/pages/GuestSupport";

export const metadata: Metadata = { robots: { index: false } };

export default function GuestChatPage() {
  return <GuestChatView />;
}
