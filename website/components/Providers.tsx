"use client";

import { ReactNode } from "react";
import { ensureSharedConfig } from "@/lib/api-init";
import { AuthProvider } from "@/contexts/AuthContext";
import { BookingDataProvider } from "@/contexts/BookingDataContext";

export function Providers({ children }: { children: ReactNode }) {
  // Must run during render, not in useEffect — child useEffects run before parent useEffects.
  ensureSharedConfig();

  return (
    <AuthProvider>
      <BookingDataProvider>{children}</BookingDataProvider>
    </AuthProvider>
  );
}
