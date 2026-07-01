"use client";

import { apiUrl } from "@emmasenvy/shared";
import { getAuthToken } from "./storage";

export async function uploadWithAuth(
  path: string,
  formData: FormData,
  token?: string | null
): Promise<Response> {
  const authToken = token ?? getAuthToken();
  const headers: HeadersInit = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return fetch(apiUrl(path), { method: "POST", headers, body: formData });
}

export function fileToFormField(file: File, fieldName: string): FormData {
  const fd = new FormData();
  fd.append(fieldName, file);
  return fd;
}

export async function pickFiles(accept = "image/*", multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
    };
    input.click();
  });
}
