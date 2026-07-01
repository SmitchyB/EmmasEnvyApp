import { durationToMinutes } from "@emmasenvy/shared";

export const BUSINESS_TZ = "America/Denver";

export function normalizeAppointmentYmd(dateRaw: string | null | undefined): string {
  if (dateRaw == null) return "";
  const s = String(dateRaw).trim();
  const isoDay = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
  }
  return s;
}

export function formatAppointmentDate(dateRaw: string): string {
  const ymd = normalizeAppointmentYmd(dateRaw);
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return ymd || String(dateRaw);
  const refUtc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return refUtc.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TZ,
  });
}

export function formatAppointmentTimeLabel(timeStr: string): string {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return timeStr;
  const hh = parseInt(m[1], 10);
  const min = m[2];
  const d = new Date(Date.UTC(2000, 0, 1, hh, parseInt(min, 10), 0));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
}

export function upcomingDateStrings(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return out;
}

export function formatAppointmentMoney(amount: number | null | undefined): string | null {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return `$${Number(amount).toFixed(2)}`;
}

export function formatWorkflowTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: BUSINESS_TZ,
    });
  } catch {
    return "—";
  }
}

export function appointmentCostDisplay(
  a: {
    status?: string | null;
    invoice_total_amount?: number | null;
    invoice_payment_status?: string | null;
    paid_at?: string | null;
    service_type_id?: number | null;
  },
  servicePrice?: number | null
): { line: string; hint?: string } | null {
  if (a.status === "Canceled") return null;
  const paid =
    !!a.paid_at || a.invoice_payment_status === "Paid" || a.status === "Paid";
  const amount = a.invoice_total_amount ?? servicePrice ?? null;
  const money = formatAppointmentMoney(amount);
  if (!money) return null;
  if (paid) return { line: `Paid ${money}` };
  if (a.invoice_total_amount != null) {
    return {
      line: `Est. ${money}`,
      hint: "Final total may change at checkout (tips, promos, or rewards).",
    };
  }
  return { line: `From ${money}` };
}

type DurationInput =
  | string
  | { hours?: number; minutes?: number; seconds?: number; days?: number }
  | null
  | undefined;

export function appointmentDurationMinutes(duration: DurationInput): number {
  if (duration == null) return 0;
  if (typeof duration === "object") {
    const h = Math.floor(Number(duration.hours) || 0);
    const m = Math.floor(Number(duration.minutes) || 0);
    const s = Math.floor(Number(duration.seconds) || 0);
    const days = Math.floor(Number(duration.days) || 0);
    return (h + days * 24) * 60 + m + s / 60;
  }
  return durationToMinutes(duration);
}

export function formatAppointmentDuration(duration: DurationInput): string | null {
  const mins = Math.round(appointmentDurationMinutes(duration));
  if (mins <= 0) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}
