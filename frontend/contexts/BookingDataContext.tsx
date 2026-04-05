import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'; // Import React and hooks from the react library
import { listAppointments } from '@/lib/booking-api'; // Import the listAppointments function from the booking-api file
import type { Appointment } from '@/lib/booking-types'; // Import the Appointment type from the booking-types file
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook from the AuthContext file

// Define the BookingDataContextValue interface
export interface BookingDataContextValue {
  appointments: Appointment[]; // Cached list from GET /api/appointments
  loading: boolean; // True while a list fetch is in flight
  error: string | null; // Last fetch error message or null
  refreshAppointments: () => Promise<void>; // Reload appointments from the API
}

const BookingDataContext = createContext<BookingDataContextValue | null>(null); // Internal context object

// Define the BookingDataProvider component
export function BookingDataProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth(); // Auth token for authenticated list endpoint
  const [appointments, setAppointments] = useState<Appointment[]>([]); // Rows returned from the server
  const [loading, setLoading] = useState(false); // Loading flag for list requests
  const [error, setError] = useState<string | null>(null); // User-visible error string

  // Define the refreshAppointments function
  const refreshAppointments = useCallback(async () => {
    // If the token is not set, return
    if (!token) {
      setAppointments([]); // Signed out: clear list
      setError(null); // Clear stale errors
      return;
    }
    setLoading(true); // Show loading in consumers
    setError(null); // Reset error before fetch
    try {
      const rows = await listAppointments(token); // Fetch all appointments visible to this user
      setAppointments(rows); // Store in context state
    } catch (e) {
      setAppointments([]); // Avoid showing stale data on failure
      setError(e instanceof Error ? e.message : 'Failed to load appointments'); // Surface message to UI
    } finally {
      setLoading(false); // End loading state
    }
  }, [token]); // Re-create when token changes

  //useEffect to refresh the appointments when the refreshAppointments identity changes
  useEffect(() => {
    refreshAppointments(); // Initial load and whenever refreshAppointments identity changes
  }, [refreshAppointments]);

  //useMemo to create the value object
  const value = useMemo<BookingDataContextValue>(
    () => ({
      appointments, // Current list
      loading, // Current loading flag
      error, // Current error
      refreshAppointments, // Stable callback from useCallback
    }),
    [appointments, loading, error, refreshAppointments] // Rebuild value object when any piece changes
  );

  return <BookingDataContext.Provider value={value}>{children}</BookingDataContext.Provider>;
}

// Define the useBookingData function
export function useBookingData(): BookingDataContextValue {
  const ctx = useContext(BookingDataContext); // Read provider value
  // If the context is not found, throw an error
  if (!ctx) {
    throw new Error('useBookingData must be used within BookingDataProvider'); // Misuse guard
  }
  return ctx; // Non-null context value
}
