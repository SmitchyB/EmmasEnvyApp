import type { Metadata } from "next";
import { GuestClaimForm } from "@/components/pages/GuestSupport";
import { SearchParamsSuspense } from "@/components/SearchParamsSuspense";

export const metadata: Metadata = { robots: { index: false } };

export default function GuestClaimPage() {
  return (
    <SearchParamsSuspense>
      <GuestClaimForm />
    </SearchParamsSuspense>
  );
}
