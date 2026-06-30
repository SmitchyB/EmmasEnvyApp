import { apiUrl } from '../config';
import { fetchWithAuth } from './client';
import { readError } from '../utils/http';
import type { DataExportPayload } from '../types/data-privacy';

export async function requestDataExport(token: string): Promise<{ message: string; export: DataExportPayload }> {
  const res = await fetchWithAuth(
    apiUrl('/api/data-privacy/request-data-export'),
    { method: 'POST', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { message: string; export: DataExportPayload };
}

export async function deleteAccountApi(token: string, password: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(
    apiUrl('/api/data-privacy/delete-account'),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { message: string };
}
