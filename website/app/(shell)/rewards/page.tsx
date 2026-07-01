import type { Metadata } from "next";
import { RewardsView } from "@/components/pages/RewardsView";

export const metadata: Metadata = {
  title: "Rewards",
  description: "Browse loyalty rewards at Emmas Envy.",
};

export default function RewardsPage() {
  return <RewardsView />;
}
