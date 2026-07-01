"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffRole } from "@emmasenvy/shared";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function StaffGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isStaffRole(user?.role)) {
      router.replace("/account");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) return <LoadingSpinner label="Checking access…" />;
  if (!isAuthenticated || !isStaffRole(user?.role)) return null;
  return <>{children}</>;
}
