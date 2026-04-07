import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiUrl, fetchWithAuth } from '@/lib/api';

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export interface DataExportPayload {
  exported_at: string;
  user: {
    id: number;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    dob: string | null;
    created_at: string;
    updated_at: string;
    reward_points: number;
  } | null;
  invoices: {
    invoice_id: string;
    created_at: string;
    total_amount: number;
    currency: string | null;
    payment_status: string | null;
  }[];
}

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

/** Writes JSON under the app cache directory and opens the system share sheet (Save to Files, Mail, etc.). Clipboard fallback if sharing is unavailable. The file stays in cache until the OS reclaims space or a later export overwrites the same dated name. */
export async function saveDataExportFile(exportPayload: DataExportPayload): Promise<void> {
  const text = JSON.stringify(exportPayload, null, 2);
  const filename = `emmas-envy-data-export-${exportPayload.exported_at.slice(0, 10)}.json`;
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(text, { encoding: 'utf8' });

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: 'Save your data export',
      });
    } else {
      await Clipboard.setStringAsync(text);
    }
  } catch {
    await Clipboard.setStringAsync(text);
  }
}
