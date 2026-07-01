import type { Metadata } from "next";
import { SettingsView } from "@/components/pages/SettingsView";

export const metadata: Metadata = { robots: { index: false } };

export default function SettingsPage() {
  return <SettingsView />;
}
