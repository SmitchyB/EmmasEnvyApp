import { apiUrl, fetchWithAuth } from '@/lib/api'; // Import the apiUrl and fetchWithAuth helpers from the api module
import type { Appointment, CreateAppointmentBody, ServiceType } from '@/lib/booking-types'; // Import the Appointment, CreateAppointmentBody, and ServiceType types from the booking-types file

// Function to parse JSON error bodies from failed fetch responses
async function readError(res: Response): Promise<string> {
  // Try to read the error from the response
  try {
    const data = (await res.json()) as { error?: string }; // Prefer server `error` string
    return data.error || res.statusText || `HTTP ${res.status}`; // Fallback chain
  } catch {
    return res.statusText || `HTTP ${res.status}`; // Non-JSON error page
  }
}

// Function to pause between retry attempts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms)); // Timer-based resolve
}

// Function to decide whether an HTTP status should trigger retry
function isTransientHttpStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429; // Server overload, timeout, rate limit
}

// Function to classify React Native / browser network failures as retryable
function isLikelyTransientFetchError(e: unknown): boolean {
  if (!(e instanceof Error)) return false; // Only inspect Error shapes
  const m = e.message.toLowerCase(); // Normalize for substring checks
  return (
    m.includes('network request failed') || // If the message includes 'network request failed'
    m.includes('failed to fetch') || // If the message includes 'failed to fetch'
    m.includes('networkerror') || // If the message includes 'networkerror'
    m.includes('timeout') || // If the message includes 'timeout'
    m.includes('econnreset') || // If the message includes 'econnreset'
    m.includes('socket') // If the message includes 'socket'
  );
}

// Function to pick filename and mime for after-visit photo uploads
export function afterPhotoFilePart(mimeType: string | null | undefined): { fileName: string; mimeType: string } {
  const raw = (mimeType && /^image\//i.test(String(mimeType)) ? String(mimeType) : 'image/jpeg').toLowerCase(); // Default JPEG
  if (raw.includes('png')) return { fileName: 'after.png', mimeType: 'image/png' }; // PNG branch
  if (raw.includes('webp')) return { fileName: 'after.webp', mimeType: 'image/webp' }; // WebP branch
  if (raw.includes('gif')) return { fileName: 'after.gif', mimeType: 'image/gif' }; // GIF branch
  return { fileName: 'after.jpg', mimeType: 'image/jpeg' }; // JPEG fallback
}

// Function to GET computed slot strings for a date and service type
export async function fetchAppointmentAvailability(
  params: { date: string; serviceTypeId: number; ignoreAppointmentId?: number }, // Parameters for the fetchAppointmentAvailability function
  token: string | null | undefined // Token for the fetchAppointmentAvailability function
): Promise<string[]> {
  // Create the query string
  const qs = new URLSearchParams({
    date: params.date, // YYYY-MM-DD
    service_type_id: String(params.serviceTypeId), // Numeric id as string
  });
  // If the ignore appointment id is not null, set the ignore appointment id in the query string
  if (params.ignoreAppointmentId != null) {
    qs.set('ignore_appointment_id', String(params.ignoreAppointmentId)); // Reschedule carve-out
  }
  // Fetch the appointment availability
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/availability?${qs.toString()}`), // API URL with the query string
    { method: 'GET', headers: { Accept: 'application/json' } }, // Headers for the fetch
    token
  );
  if (!res.ok) throw new Error(await readError(res)); // Surface API message
  const data = (await res.json()) as { slots?: string[] }; // Typed envelope
  return data.slots ?? []; // Empty array when missing
}

// Function to list appointments with optional filter query string
export async function listAppointments(
  token: string, // Token for the listAppointments function
  query?: Record<string, string | undefined> // Query for the listAppointments function
): Promise<Appointment[]> {
  const qs = new URLSearchParams(); // Build from optional map
  // If the query is not null, set the query in the query string
  if (query) {
    // Loop through the query
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') qs.set(k, v); // Skip undefined and empty
    }
  }
  const path = qs.toString() ? `/api/appointments?${qs}` : '/api/appointments'; // With or without query
  const res = await fetchWithAuth(apiUrl(path), { method: 'GET', headers: { Accept: 'application/json' } }, token); // Fetch the appointments
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { appointments?: Appointment[] }; // Parse the response as an Appointment array
  return data.appointments ?? []; // Return the appointments
}

// Function to fetch one appointment row by id
export async function getAppointment(token: string, id: number): Promise<Appointment> {
  const res = await fetchWithAuth(apiUrl(`/api/appointments/${id}`), { method: 'GET', headers: { Accept: 'application/json' } }, token); // Fetch the appointment
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as Appointment; // Parse the response as an Appointment
}

// Function to create a booking
export async function createAppointment(
  body: CreateAppointmentBody, // Body for the createAppointment function
  token: string | null | undefined // Token for the createAppointment function
): Promise<Appointment> {
  // Fetch the create appointment endpoint
  const res = await fetchWithAuth( 
    apiUrl('/api/appointments'), // API URL for the create appointment endpoint
    {
      method: 'POST', // POST request to the create appointment endpoint
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, // Headers for the request
      body: JSON.stringify(body), // Body for the request
    },
    token // Token for the createAppointment function
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as Appointment; // Parse the response as an Appointment
}

// Function to PATCH-style replace fields on an existing appointment
export async function updateAppointment(
  token: string, // Token for the updateAppointment function
  id: number, // ID for the updateAppointment function
  patch: Partial<{
    client_name: string; // Client name for the updateAppointment function
    client_email: string | null; // Client email for the updateAppointment function
    client_phone: string | null; // Client phone for the updateAppointment function
    client_id: number | null; // Client ID for the updateAppointment function
    employee_id: number; // Employee ID for the updateAppointment function
    service_type_id: number; // Service type ID for the updateAppointment function
    date: string; // Date for the updateAppointment function
    time: string; // Time for the updateAppointment function
    description: string; // Description for the updateAppointment function
    status: string; // Status for the updateAppointment function
    inspo_pics: string[] | null; // Inspiration pictures for the updateAppointment function
  }>
): Promise<Appointment> {
  // Fetch the update appointment endpoint
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/${id}`), // API URL for the update appointment endpoint
    {
      method: 'PUT', // PUT request to the update appointment endpoint
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, // Headers for the request
      body: JSON.stringify(patch), // Body for the request
    },
    token // Token for the updateAppointment function
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as Appointment; // Parse the response as an Appointment
}

// Function to mark an appointment canceled via dedicated route
export async function cancelAppointmentApi(token: string, id: number): Promise<Appointment> {
  // Fetch the cancel appointment endpoint
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/${id}/cancel`), // API URL for the cancel appointment endpoint
    { method: 'PATCH', headers: { Accept: 'application/json' } }, // Headers for the request
    token // Token for the cancelAppointmentApi function
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as Appointment; // Parse the response as an Appointment
}

// Function to POST multipart finished photo with exponential-ish backoff retries
export async function uploadAppointmentFinishedPhoto(
  token: string, // Token for the uploadAppointmentFinishedPhoto function
  appointmentId: number, // Appointment ID for the uploadAppointmentFinishedPhoto function
  imageUri: string, // Image URI for the uploadAppointmentFinishedPhoto function
  fileName: string = 'after.jpg', // File name for the uploadAppointmentFinishedPhoto function
  mimeType: string = 'image/jpeg', // MIME type for the uploadAppointmentFinishedPhoto function
): Promise<{ photo: string; appointment: Appointment }> {
  const maxAttempts = 4; // Cap retry loop
  let lastError: Error | null = null; // Carry message between attempts
  // Loop through the attempts
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const formData = new FormData(); // RN expects { uri, name, type } pseudo-blob
    // Append the photo to the form data
    formData.append(
      'photo', // Photo field name
      {
        uri: imageUri, // Image URI
        name: fileName, // File name
        type: mimeType, // MIME type
      } as unknown as Blob // Blob of the photo
    );
    // Try to upload the finished photo
    try {
      // Fetch the finished photo endpoint
      const res = await fetchWithAuth(
        apiUrl(`/api/appointments/${appointmentId}/finished-photo`), // API URL for the finished photo endpoint
        {
          method: 'POST', // POST request to the finished photo endpoint
          headers: { Accept: 'application/json' }, // Headers for the request
          body: formData, // Body for the request
        },
        token // Token for the uploadAppointmentFinishedPhoto function
      );
      let data: { photo?: string; appointment?: Appointment; error?: string } = {}; // Data for the finished photo
      // Try to parse the response as JSON
      try {
        data = (await res.json()) as typeof data; // Parse when body is JSON
      } catch {
        // Non-JSON body on some error paths
      }
      // If the response is ok and the appointment and photo are not null, return the photo and appointment
      if (res.ok && data.appointment && data.photo != null) {
        return { photo: data.photo, appointment: data.appointment }; // Success tuple
      }
      const msg = data.error || res.statusText || `HTTP ${res.status}`; // Human-readable failure
      lastError = new Error(msg); // Set the last error to the error message
      // If the attempt is less than the maximum attempts and the response is transient, retry the request
      const retry =
        attempt < maxAttempts && (isTransientHttpStatus(res.status) || res.status === 0); // 0 = opaque network failure in some stacks
      // If the retry is true, sleep for 350 * attempt milliseconds and continue the loop
        if (retry) {
        await sleep(350 * attempt); // Backoff before retry
        continue;
      }
      throw lastError; // Give up on non-transient HTTP errors
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e)); // Normalize thrown value
      lastError = err; // Set the last error to the error
      // If the attempt is less than the maximum attempts and the error is transient, sleep for 350 * attempt milliseconds and continue the loop
      if (attempt < maxAttempts && isLikelyTransientFetchError(err)) {
        await sleep(350 * attempt); // Retry transport failures
        continue;
      }
      throw err; // Fatal or last attempt
    }
  }
  throw lastError ?? new Error('Upload failed'); // Should not reach; satisfies TypeScript
}

// Function to mint a short-lived JWT for guest inspiration uploads tied to an appointment
export async function requestInspoUploadToken(token: string, appointmentId: number): Promise<string> {
  // Fetch the inspo upload token endpoint
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/${appointmentId}/inspo-upload-token`), // API URL for the inspo upload token endpoint
    { method: 'POST', headers: { Accept: 'application/json' } }, // Headers for the request
    token // Token for the requestInspoUploadToken function
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  const data = (await res.json()) as { token?: string }; // Parse the response as a string
  if (!data.token) throw new Error('No token returned'); // Contract guard
  return data.token; // Return the token
}

// Function to append relative inspo paths using guest JWT (no staff session)
export async function appendInspoGuest(jwtToken: string, inspoPics: string[]): Promise<void> {
  // Fetch the append inspo guest endpoint
  const res = await fetch(apiUrl('/api/appointments/inspo-guest'), {
    method: 'PATCH', // PATCH request to the append inspo guest endpoint
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, // Headers for the request
    body: JSON.stringify({ token: jwtToken, inspo_pics: inspoPics }), // Body for the request
  });
  if (!res.ok) throw new Error(await readError(res)); // 4xx/5xx bubble up
}

// Function to load all public bookable service types (no auth)
export async function fetchPublicServiceTypes(): Promise<ServiceType[]> {
  const res = await fetch(apiUrl('/api/service-types/public'), {
    method: 'GET', // GET request to the fetchPublicServiceTypes function
    headers: { Accept: 'application/json' }, // Headers for the request
  });
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as ServiceType[]; // Raw array response
}

// Function to list service types owned by the signed-in stylist
export async function listMyServiceTypes(token: string): Promise<ServiceType[]> {
  const res = await fetchWithAuth(apiUrl('/api/service-types'), { method: 'GET', headers: { Accept: 'application/json' } }, token); // Fetch the service types
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as ServiceType[]; // Parse the response as an ServiceType array
}

// Function to create a new service type row for the current user
export async function createServiceTypeApi(
  token: string, // Token for the createServiceTypeApi function
  body: { title: string; description?: string | null; duration_needed?: string | null; price?: number | null; tags?: string[] | null }
): Promise<ServiceType> {
  // Fetch the create service type endpoint
  const res = await fetchWithAuth(
    apiUrl('/api/service-types'), // API URL for the create service type endpoint
    {
      method: 'POST', // POST request to the create service type endpoint
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, // Headers for the request
      body: JSON.stringify(body), // Body for the request
    },
    token // Token for the createServiceTypeApi function
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as ServiceType; // Parse the response as an ServiceType
}

// Function to update fields on an existing service type
export async function updateServiceTypeApi(
  token: string, // Token for the updateServiceTypeApi function
  id: number, // ID for the updateServiceTypeApi function
  body: Partial<{ title: string; description: string | null; duration_needed: string | null; price: number | null; tags: string[] | null }>
): Promise<ServiceType> {
  // Fetch the update service type endpoint
  const res = await fetchWithAuth(
    apiUrl(`/api/service-types/${id}`), // API URL for the update service type endpoint
    {
      method: 'PUT', // PUT request to the update service type endpoint
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, // Headers for the request
      body: JSON.stringify(body), // Body for the request
    },
    token // Token for the updateServiceTypeApi function
  );
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  return (await res.json()) as ServiceType; // Parse the response as an ServiceType
}

// Function to delete a service type; consumes optional non-204 body safely
export async function deleteServiceTypeApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/service-types/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res)); // If the response is not ok, throw an error
  if (res.status !== 204) await res.text().catch(() => {}); // Drain body when server returns JSON message on success
}