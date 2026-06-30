import { apiUrl } from '../config';
import { fetchWithAuth } from './client';
import {
  readError,
  sleep,
  isTransientHttpStatus,
  isLikelyTransientFetchError,
} from '../utils/http';
import type { Appointment, CreateAppointmentBody, ServiceType } from '../types/booking';

export async function fetchAppointmentAvailability(
  params: { date: string; serviceTypeId: number; ignoreAppointmentId?: number },
  token: string | null | undefined
): Promise<string[]> {
  const qs = new URLSearchParams({
    date: params.date,
    service_type_id: String(params.serviceTypeId),
  });
  if (params.ignoreAppointmentId != null) {
    qs.set('ignore_appointment_id', String(params.ignoreAppointmentId));
  }
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/availability?${qs.toString()}`),
    { method: 'GET', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { slots?: string[] };
  return data.slots ?? [];
}

export async function listAppointments(
  token: string,
  query?: Record<string, string | undefined>
): Promise<Appointment[]> {
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') qs.set(k, v);
    }
  }
  const path = qs.toString() ? `/api/appointments?${qs}` : '/api/appointments';
  const res = await fetchWithAuth(apiUrl(path), { method: 'GET', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { appointments?: Appointment[] };
  return data.appointments ?? [];
}

export async function getAppointment(token: string, id: number): Promise<Appointment> {
  const res = await fetchWithAuth(apiUrl(`/api/appointments/${id}`), { method: 'GET', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Appointment;
}

export async function createAppointment(
  body: CreateAppointmentBody,
  token: string | null | undefined
): Promise<Appointment> {
  const res = await fetchWithAuth(
    apiUrl('/api/appointments'),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Appointment;
}

export async function updateAppointment(
  token: string,
  id: number,
  patch: Partial<{
    client_name: string;
    client_email: string | null;
    client_phone: string | null;
    client_id: number | null;
    employee_id: number;
    service_type_id: number;
    date: string;
    time: string;
    description: string;
    status: string;
    inspo_pics: string[] | null;
  }>
): Promise<Appointment> {
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/${id}`),
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Appointment;
}

export async function cancelAppointmentApi(token: string, id: number): Promise<Appointment> {
  const res = await fetchWithAuth(
    apiUrl(`/api/appointments/${id}/cancel`),
    { method: 'PATCH', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Appointment;
}

export async function uploadAppointmentFinishedPhoto(
  token: string,
  appointmentId: number,
  formData: FormData
): Promise<{ photo: string; appointment: Appointment }> {
  const maxAttempts = 4;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithAuth(
        apiUrl(`/api/appointments/${appointmentId}/finished-photo`),
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData,
        },
        token
      );
      let data: { photo?: string; appointment?: Appointment; error?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        // non-JSON body
      }
      if (res.ok && data.appointment && data.photo != null) {
        return { photo: data.photo, appointment: data.appointment };
      }
      const msg = data.error || res.statusText || `HTTP ${res.status}`;
      lastError = new Error(msg);
      const retry = attempt < maxAttempts && (isTransientHttpStatus(res.status) || res.status === 0);
      if (retry) {
        await sleep(350 * attempt);
        continue;
      }
      throw lastError;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;
      if (attempt < maxAttempts && isLikelyTransientFetchError(err)) {
        await sleep(350 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error('Upload failed');
}

export async function fetchPublicServiceTypes(): Promise<ServiceType[]> {
  const res = await fetch(apiUrl('/api/service-types/public'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ServiceType[];
}

export async function listMyServiceTypes(token: string): Promise<ServiceType[]> {
  const res = await fetchWithAuth(apiUrl('/api/service-types'), { method: 'GET', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ServiceType[];
}

export async function createServiceTypeApi(
  token: string,
  body: { title: string; description?: string | null; duration_needed?: string | null; price?: number | null; tags?: string[] | null }
): Promise<ServiceType> {
  const res = await fetchWithAuth(
    apiUrl('/api/service-types'),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ServiceType;
}

export async function updateServiceTypeApi(
  token: string,
  id: number,
  body: Partial<{ title: string; description: string | null; duration_needed: string | null; price: number | null; tags: string[] | null }>
): Promise<ServiceType> {
  const res = await fetchWithAuth(
    apiUrl(`/api/service-types/${id}`),
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ServiceType;
}

export async function deleteServiceTypeApi(token: string, id: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/service-types/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token);
  if (!res.ok) throw new Error(await readError(res));
  if (res.status !== 204) await res.text().catch(() => {});
}
