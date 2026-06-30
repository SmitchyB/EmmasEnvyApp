import type { Appointment } from '../types/booking';
import { STATUS_CANCELED, DEFAULT_DAY_START, DEFAULT_DAY_END, SLOT_STEP_MINUTES } from '../constants/booking';
import {
  durationToMinutes,
  timeToMinutes,
  minutesToTime,
} from './booking-duration';

export { DEFAULT_DAY_START, DEFAULT_DAY_END, SLOT_STEP_MINUTES };

function appointmentBlocksForDay(
  appointments: Appointment[],
  employeeId: number,
  date: string,
  ignoreAppointmentId?: number
): [number, number][] {
  const blocks: [number, number][] = [];
  for (const row of appointments) {
    if (ignoreAppointmentId != null && row.id === ignoreAppointmentId) continue;
    if (row.employee_id !== employeeId || row.date !== date) continue;
    if (row.status === STATUS_CANCELED) continue;
    const t = timeToMinutes(row.time);
    let dur = durationToMinutes(row.duration);
    if (dur <= 0) dur = 60;
    blocks.push([t, t + dur]);
  }
  blocks.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of blocks) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

function gapsFromMerged(merged: [number, number][], startMin: number, endMin: number): [number, number][] {
  const gaps: [number, number][] = [];
  let prevEnd = startMin;
  for (const [s, e] of merged) {
    if (s > prevEnd) gaps.push([prevEnd, s]);
    prevEnd = Math.max(prevEnd, e);
  }
  if (prevEnd < endMin) gaps.push([prevEnd, endMin]);
  return gaps;
}

export function computeAvailableSlots(
  appointments: Appointment[],
  params: {
    date: string;
    employeeId: number;
    durationMinutes: number;
    ignoreAppointmentId?: number;
    dayStart?: string;
    dayEnd?: string;
    slotStepMinutes?: number;
  }
): string[] {
  const {
    date,
    employeeId,
    durationMinutes,
    ignoreAppointmentId,
    dayStart = DEFAULT_DAY_START,
    dayEnd = DEFAULT_DAY_END,
    slotStepMinutes: slotStep = SLOT_STEP_MINUTES,
  } = params;

  const startMin = timeToMinutes(dayStart);
  const endMin = timeToMinutes(dayEnd);
  const merged = appointmentBlocksForDay(appointments, employeeId, date, ignoreAppointmentId);
  const gaps = gapsFromMerged(merged, startMin, endMin);

  const slots: string[] = [];
  for (const [gapStart, gapEnd] of gaps) {
    const gapLen = gapEnd - gapStart;
    if (gapLen < durationMinutes) continue;
    for (let t = gapStart; t + durationMinutes <= gapEnd; t += slotStep) {
      slots.push(minutesToTime(t));
    }
  }
  return slots;
}

export function isSlotStillAvailable(
  appointments: Appointment[],
  params: {
    date: string;
    time: string;
    employeeId: number;
    durationMinutes: number;
    ignoreAppointmentId?: number;
  }
): boolean {
  const slots = computeAvailableSlots(appointments, {
    date: params.date,
    employeeId: params.employeeId,
    durationMinutes: params.durationMinutes,
    ignoreAppointmentId: params.ignoreAppointmentId,
  });
  return slots.includes(params.time);
}
