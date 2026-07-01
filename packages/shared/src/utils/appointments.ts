import { STATUS_CANCELED } from '../constants/booking';
import type { Appointment } from '../types/booking';

export const BUSINESS_TZ = 'America/Denver';

export function normalizeAppointmentYmd(dateRaw: string | null | undefined): string {
  if (dateRaw == null) return '';
  const s = String(dateRaw).trim();
  const isoDay = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });
  }
  return s;
}

function parseAppointmentMinutes(timeStr: string): number {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function nowInBusinessTz(): { ymd: string; minutes: number } {
  const d = new Date();
  const ymd = d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });
  const hm = d.toLocaleTimeString('en-GB', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hh, mm] = hm.split(':').map((x) => parseInt(x, 10));
  return { ymd, minutes: (hh || 0) * 60 + (mm || 0) };
}

export function isAppointmentPastStart(a: Appointment): boolean {
  const now = nowInBusinessTz();
  const ymd = normalizeAppointmentYmd(a.date);
  if (!ymd) return false;
  if (ymd < now.ymd) return true;
  if (ymd > now.ymd) return false;
  return parseAppointmentMinutes(a.time) < now.minutes;
}

function compareAppointments(a: Appointment, b: Appointment): number {
  const da = normalizeAppointmentYmd(a.date).localeCompare(normalizeAppointmentYmd(b.date));
  if (da !== 0) return da;
  return a.time.localeCompare(b.time);
}

/** Earliest future non-canceled appointment, or null. */
export function findNextUpcomingAppointment(appointments: Appointment[]): Appointment | null {
  const upcoming = appointments
    .filter((a) => a.status !== STATUS_CANCELED && !isAppointmentPastStart(a))
    .sort(compareAppointments);
  return upcoming[0] ?? null;
}
