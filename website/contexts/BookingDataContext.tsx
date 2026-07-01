"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listAppointments, type Appointment } from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";

export interface BookingDataContextValue {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  refreshAppointments: () => Promise<void>;
}

const BookingDataContext = createContext<BookingDataContextValue | null>(null);

export function BookingDataProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAppointments = useCallback(async () => {
    if (!token) {
      setAppointments([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listAppointments(token);
      setAppointments(rows);
    } catch (e) {
      setAppointments([]);
      setError(e instanceof Error ? e.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshAppointments();
  }, [refreshAppointments]);

  const value = useMemo(
    () => ({ appointments, loading, error, refreshAppointments }),
    [appointments, loading, error, refreshAppointments]
  );

  return <BookingDataContext.Provider value={value}>{children}</BookingDataContext.Provider>;
}

export function useBookingData(): BookingDataContextValue {
  const ctx = useContext(BookingDataContext);
  if (!ctx) throw new Error("useBookingData must be used within BookingDataProvider");
  return ctx;
}
