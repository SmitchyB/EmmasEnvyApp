"use client";

import Link from "next/link";
import {
  findNextUpcomingAppointment,
  type ServiceType,
} from "@emmasenvy/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingData } from "@/contexts/BookingDataContext";
import { formatAppointmentDate, formatAppointmentTimeLabel } from "@/lib/appointment-utils";
import { Card } from "@/components/ui/Card";

export function HomeWelcomeBack({ serviceTypes }: { serviceTypes: ServiceType[] }) {
  const { user } = useAuth();
  const { appointments } = useBookingData();

  if (!user) return null;

  const next = findNextUpcomingAppointment(appointments);
  if (!next) return null;

  const serviceTitle =
    (next.service_type_title && String(next.service_type_title).trim()) ||
    (next.service_type_id
      ? serviceTypes.find((s) => s.id === next.service_type_id)?.title
      : null) ||
    "Appointment";

  return (
    <Card className="border-pink-light/30 bg-pink-darkest/40">
      <p className="text-sm text-white/70">
        Welcome back{user.first_name ? `, ${user.first_name}` : ""}
      </p>
      <p className="mt-1 font-semibold text-white">
        Next: {serviceTitle} on {formatAppointmentDate(next.date)} at{" "}
        {formatAppointmentTimeLabel(next.time)}
      </p>
      <Link
        href="/appointments"
        className="mt-3 inline-block text-sm font-medium text-pink-light hover:text-white"
      >
        View appointments
      </Link>
    </Card>
  );
}
