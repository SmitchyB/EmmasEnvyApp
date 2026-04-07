/** Function for staff-only features (Admin / IT). Case-insensitive vs DB casing. */
export function isStaffRole(role: string | undefined | null): boolean {
  const r = role ? String(role).toLowerCase() : '';
  return r === 'admin' || r === 'it';
}
