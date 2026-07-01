import { Verify2FAForm } from "@/components/pages/Verify2FAForm";
import { SearchParamsSuspense } from "@/components/SearchParamsSuspense";

export default function Verify2FAPage() {
  return (
    <SearchParamsSuspense>
      <Verify2FAForm />
    </SearchParamsSuspense>
  );
}
