import type { Appointment } from '@/lib/booking-types'; // Import the Appointment type from the booking-types file
import { STATUS_CANCELED } from '@/lib/booking-constants'; // Import the canceled status constant from the booking-constants file

export const DEFAULT_DAY_START = '08:00'; // Business day opens at 8:00 (matches server default)
export const DEFAULT_DAY_END = '18:00'; // Business day closes at 18:00 (matches server default)
export const SLOT_STEP_MINUTES = 15; // Offer start times every fifteen minutes within free gaps

// Function to parse API duration string (HH:MM or HH:MM:SS) to fractional minutes
export function durationToMinutes(duration: string | null | undefined): number {
  if (duration == null || duration === '') return 0; // Treat missing duration as zero length
  const str = String(duration).trim(); // Normalize whitespace
  const match = str.match(/^(\d+):(\d+)(?::(\d+))?$/); // Hours, minutes, optional seconds
  if (match) {
    const h = parseInt(match[1], 10); // Whole hours
    const m = parseInt(match[2], 10); // Whole minutes
    const s = match[3] ? parseInt(match[3], 10) : 0; // Optional seconds
    return h * 60 + m + s / 60; // Total minutes as number
  }
  return 0; // Unparseable string
}

// Function to format total minutes as HH:MM:00 for API payloads
export function minutesToDurationString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24; // Hours component wrapped to day
  const m = Math.floor(totalMinutes % 60); // Minutes remainder
  const pad = (n: number) => String(n).padStart(2, '0'); // Two-digit padding
  return `${pad(h)}:${pad(m)}:00`; // Postgres-friendly interval-style string
}

// Function to convert a wall-clock time string to minutes since midnight
export function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0; // Null or empty → midnight
  const str = String(t).trim(); // Trim input
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); // Flexible HH:MM(:SS)
  if (match) {
    const h = parseInt(match[1], 10); // Hour part
    const m = parseInt(match[2], 10); // Minute part
    return h * 60 + m; // Ignore seconds for slot grid
  }
  return 0; // Fallback
}

// Function to format minutes since midnight as HH:MM for UI chips
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24; // Hour within 24h clock
  const m = Math.floor(minutes % 60); // Minute within hour
  const pad = (n: number) => String(n).padStart(2, '0'); // Zero-pad
  return `${pad(h)}:${pad(m)}`; // Display label
}

// Function to build merged busy intervals [startMin, endMin) for one employee and calendar date
function appointmentBlocksForDay(
  appointments: Appointment[],
  employeeId: number,
  date: string,
  ignoreAppointmentId?: number
): [number, number][] {
  const blocks: [number, number][] = []; // Raw busy segments before merge
  for (const row of appointments) {
    if (ignoreAppointmentId != null && row.id === ignoreAppointmentId) continue; // Exclude current appointment when rescheduling
    if (row.employee_id !== employeeId || row.date !== date) continue; // Wrong stylist or day
    if (row.status === STATUS_CANCELED) continue; // Canceled rows do not block slots
    const t = timeToMinutes(row.time); // Start minute
    let dur = durationToMinutes(row.duration); // Length from row
    if (dur <= 0) dur = 60; // Default one hour if missing
    blocks.push([t, t + dur]); // Busy window
  }
  blocks.sort((a, b) => a[0] - b[0]); // Chronological order for merge
  const merged: [number, number][] = []; // Overlapping blocks combined
  for (const [s, e] of blocks) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e); // Extend current block
    } else {
      merged.push([s, e]); // Start new block
    }
  }
  return merged;
}
// Function to calculate the gaps from the merged busy blocks
function gapsFromMerged(merged: [number, number][], startMin: number, endMin: number): [number, number][] {
  const gaps: [number, number][] = []; // Unbooked segments inside business day
  let prevEnd = startMin; // Cursor after last busy block
  // Loop through the merged busy blocks
  for (const [s, e] of merged) {
    if (s > prevEnd) gaps.push([prevEnd, s]); // Gap before this appointment
    prevEnd = Math.max(prevEnd, e); // Advance past busy time
  }
  if (prevEnd < endMin) gaps.push([prevEnd, endMin]); // Tail gap until close
  return gaps;
}

// Function to list valid start times (HH:MM) matching server computeSlotsForDay
export function computeAvailableSlots(
  appointments: Appointment[],
  params: {
    date: string; // Date to calculate the available slots for
    employeeId: number; // Employee ID to calculate the available slots for
    durationMinutes: number; // Duration in minutes to calculate the available slots for
    ignoreAppointmentId?: number; // Appointment ID to ignore when calculating the available slots
    dayStart?: string; // Start time of the day
    dayEnd?: string; // End time of the day
    slotStepMinutes?: number; // Step in minutes to calculate the available slots for
  }
): string[] {
  // Destructure the parameters
  const {
    date, // Date to calculate the available slots for
    employeeId, // Employee ID to calculate the available slots for
    durationMinutes, // Duration in minutes to calculate the available slots for
    ignoreAppointmentId, // Appointment ID to ignore when calculating the available slots
    dayStart = DEFAULT_DAY_START, // Start time of the day
    dayEnd = DEFAULT_DAY_END, // End time of the day
    slotStepMinutes: slotStep = SLOT_STEP_MINUTES, // Step in minutes to calculate the available slots for
  } = params; // Defaults align with backend constants

  const startMin = timeToMinutes(dayStart); // Open time as minutes
  const endMin = timeToMinutes(dayEnd); // Close time as minutes
  const merged = appointmentBlocksForDay(appointments, employeeId, date, ignoreAppointmentId); // Busy timeline
  const gaps = gapsFromMerged(merged, startMin, endMin); // Free windows

  const slots: string[] = []; // Output start labels
  // Loop through the gaps
  for (const [gapStart, gapEnd] of gaps) {
    const gapLen = gapEnd - gapStart; // Length of free window
    if (gapLen < durationMinutes) continue; // Service cannot fit
    // Loop through the gap
    for (let t = gapStart; t + durationMinutes <= gapEnd; t += slotStep) {
      slots.push(minutesToTime(t)); // Each candidate start
    }
  }
  return slots; // Return the available slots
}

// Function to check whether a chosen time still appears in recomputed slots (optimistic UI guard)
export function isSlotStillAvailable(
  appointments: Appointment[], // Appointments to check the slot availability for
  params: {
    date: string; // Date to check the slot availability for
    time: string; // Time to check the slot availability for
    employeeId: number; // Employee ID to check the slot availability for
    durationMinutes: number; // Duration in minutes to check the slot availability for
    ignoreAppointmentId?: number; // Appointment ID to ignore when checking the slot availability
  }
): boolean {
  // Compute the available slots
  const slots = computeAvailableSlots(appointments, {
    date: params.date, // Date to check the slot availability for
    employeeId: params.employeeId, // Employee ID to check the slot availability for
    durationMinutes: params.durationMinutes, // Duration in minutes to check the slot availability for
    ignoreAppointmentId: params.ignoreAppointmentId, // Appointment ID to ignore when checking the slot availability
  }); // Fresh slot list
  return slots.includes(params.time); // Exact HH:MM match
}
