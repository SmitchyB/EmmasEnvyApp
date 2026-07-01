import {
  uploadProfilePhoto as uploadProfilePhotoApi,
  uploadAppointmentFinishedPhoto as uploadAppointmentFinishedPhotoApi,
  uploadPortfolioPhoto as uploadPortfolioPhotoApi,
} from '@emmasenvy/shared';
import type { Appointment, PortfolioPhoto, User } from '@emmasenvy/shared';
import { buildRnImageFormData } from '@/lib/upload-form-data';

export async function uploadProfilePhoto(
  token: string,
  imageUri: string,
  fileName: string = 'photo.jpg',
  mimeType: string = 'image/jpeg'
): Promise<{ user: User }> {
  const formData = buildRnImageFormData('photo', imageUri, fileName, mimeType);
  return uploadProfilePhotoApi(token, formData);
}

export async function uploadAppointmentFinishedPhoto(
  token: string,
  appointmentId: number,
  imageUri: string,
  fileName: string = 'after.jpg',
  mimeType: string = 'image/jpeg'
): Promise<{ photo: string; appointment: Appointment }> {
  const formData = buildRnImageFormData('photo', imageUri, fileName, mimeType);
  return uploadAppointmentFinishedPhotoApi(token, appointmentId, formData);
}

export async function uploadPortfolioPhoto(
  token: string | null | undefined,
  imageUri: string,
  fileName: string = 'portfolio-photo.jpg',
  mimeType: string = 'image/jpeg'
): Promise<{ photo: PortfolioPhoto }> {
  const formData = buildRnImageFormData('photo', imageUri, fileName, mimeType);
  return uploadPortfolioPhotoApi(token, formData);
}
