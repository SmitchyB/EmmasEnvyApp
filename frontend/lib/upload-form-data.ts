/** React Native FormData helpers for multipart image uploads. */

export function buildRnImageFormData(
  fieldName: string,
  uri: string,
  fileName: string,
  mimeType: string
): FormData {
  const formData = new FormData();
  formData.append(fieldName, {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  return formData;
}

export function afterPhotoFilePart(mimeType: string | null | undefined): { fileName: string; mimeType: string } {
  const raw = (mimeType && /^image\//i.test(String(mimeType)) ? String(mimeType) : 'image/jpeg').toLowerCase();
  if (raw.includes('png')) return { fileName: 'after.png', mimeType: 'image/png' };
  if (raw.includes('webp')) return { fileName: 'after.webp', mimeType: 'image/webp' };
  if (raw.includes('gif')) return { fileName: 'after.gif', mimeType: 'image/gif' };
  return { fileName: 'after.jpg', mimeType: 'image/jpeg' };
}
