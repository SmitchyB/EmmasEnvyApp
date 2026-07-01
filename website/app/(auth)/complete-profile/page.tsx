import { CompleteProfileForm } from "@/components/pages/CompleteProfileForm";
import { SearchParamsSuspense } from "@/components/SearchParamsSuspense";

export default function CompleteProfilePage() {
  return (
    <SearchParamsSuspense>
      <CompleteProfileForm />
    </SearchParamsSuspense>
  );
}
