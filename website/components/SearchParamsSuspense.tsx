import { ReactNode, Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function SearchParamsSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}
