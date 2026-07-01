"use client";

import { ReactNode, useEffect } from "react";
import { ensureSharedConfig } from "@/lib/api-init";
import { AuthProvider } from "@/contexts/AuthContext";
import { BookingDataProvider } from "@/contexts/BookingDataContext";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensureSharedConfig();
  }, []);

  return (
    <AuthProvider>
      <BookingDataProvider>{children}</BookingDataProvider>
    </AuthProvider>
  );
}
