import {
  uploadProfilePhoto as uploadProfilePhotoApi,
  uploadAppointmentFinishedPhoto as uploadAppointmentFinishedPhotoApi,
  uploadPortfolioPhoto as uploadPortfolioPhotoApi,
} from "@emmasenvy/shared";
import type { Appointment, PortfolioPhoto, User } from "@emmasenvy/shared";

function buildFileFormData(fieldName: string, file: File): FormData {
  const fd = new FormData();
  fd.append(fieldName, file);
  return fd;
}

export async function uploadProfilePhotoWeb(token: string, file: File): Promise<{ user: User }> {
  return uploadProfilePhotoApi(token, buildFileFormData("photo", file));
}

export async function uploadAppointmentFinishedPhotoWeb(
  token: string,
  appointmentId: number,
  file: File
): Promise<{ photo: string; appointment: Appointment }> {
  return uploadAppointmentFinishedPhotoApi(token, appointmentId, buildFileFormData("photo", file));
}

export async function uploadPortfolioPhotoWeb(
  token: string | null | undefined,
  file: File
): Promise<{ photo: PortfolioPhoto }> {
  return uploadPortfolioPhotoApi(token, buildFileFormData("photo", file));
}

export function downloadJsonExport(data: unknown, filename = "emmas-envy-export.json"): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
