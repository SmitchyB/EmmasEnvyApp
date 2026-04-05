
// Function to parse API duration string (HH:MM or HH:MM:SS) to fractional minutes
export function durationToMinutes(duration: string | null | undefined): number {
  if (duration == null || duration === '') return 0; // If the duration is null or empty, return 0
  const str = String(duration).trim(); // Convert the duration to a string and trim the whitespace
  const match = str.match(/^(\d+):(\d+)(?::(\d+))?$/); // Match the duration to the pattern
  // If the match is found, return the duration in minutes
  if (match) {
    const h = parseInt(match[1], 10); // Convert the hours to an integer
    const m = parseInt(match[2], 10); // Convert the minutes to an integer
    const s = match[3] ? parseInt(match[3], 10) : 0; // Convert the seconds to an integer
    return h * 60 + m + s / 60; // Return the duration in minutes
  }
  return 0; // If the match is not found, return 0
}

// Function to format total minutes as HH:MM:00 for API payloads
export function minutesToDurationString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24; // Convert the total minutes to hours
  const m = Math.floor(totalMinutes % 60); // Convert the total minutes to minutes
  const pad = (n: number) => String(n).padStart(2, '0'); // Pad the number with 0s
  return `${pad(h)}:${pad(m)}:00`; // Return the duration in the format of hours:minutes:00
}
