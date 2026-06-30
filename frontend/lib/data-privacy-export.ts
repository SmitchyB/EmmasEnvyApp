import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DataExportPayload } from '@emmasenvy/shared';

/** Writes JSON under the app cache directory and opens the system share sheet. */
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
