/** Function for staff-only features. */
export function isStaffRole(role: string | undefined | null): boolean {
  return role === 'Admin' || role === 'IT';
}
