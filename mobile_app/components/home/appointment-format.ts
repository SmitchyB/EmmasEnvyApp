const BUSINESS_TZ = 'America/Denver';

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

export function formatAppointmentDate(dateRaw: string): string {
  const ymd = normalizeAppointmentYmd(dateRaw);
  const [y, mo, d] = ymd.split('-').map(Number);
  if (!y || !mo || !d) return ymd || String(dateRaw);
  const refUtc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return refUtc.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: BUSINESS_TZ,
  });
}

export function formatAppointmentTimeLabel(timeStr: string): string {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return timeStr;
  const hh = parseInt(m[1], 10);
  const min = m[2];
  const d = new Date(Date.UTC(2000, 0, 1, hh, parseInt(min, 10), 0));
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}
