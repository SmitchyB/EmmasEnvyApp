import { apiUrl } from '../config';
import { parseJson } from '../utils/http';
import type { AuthSession, AuthSessionItem, Requires2FAResponse, User } from '../types/auth';

export async function login(params: {
  email?: string;
  phone?: string;
  password: string;
  staySignedIn?: boolean;
  deviceId?: string;
}): Promise<{ user: User; token: string } | Requires2FAResponse> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: params.email?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
      password: params.password,
      staySignedIn: !!params.staySignedIn,
      deviceId: params.deviceId || undefined,
    }),
  });
  const data = await parseJson<{ user?: User; token?: string; requires2FA?: boolean; tempToken?: string; twoFactorType?: string }>(res);
  if (!res.ok) {
    const err = (data as { error?: string }).error || res.statusText;
    throw new Error(err);
  }
  if ((data as Requires2FAResponse).requires2FA && (data as Requires2FAResponse).tempToken) {
    return data as Requires2FAResponse;
  }
  return data as AuthSession;
}

export async function register(params: {
  email?: string;
  phone?: string;
  password: string;
  deviceId?: string;
  two_factor_enabled?: boolean;
  two_factor_type?: 'email' | 'phone' | 'totp';
}): Promise<AuthSession | (Requires2FAResponse & { user: User; totp_setup?: { secret: string; qr_url: string } })> {
  const body: Record<string, unknown> = {
    email: params.email?.trim() || undefined,
    phone: params.phone?.trim() || undefined,
    password: params.password,
    deviceId: params.deviceId || undefined,
  };
  if (params.two_factor_enabled !== undefined) body.two_factor_enabled = params.two_factor_enabled;
  if (params.two_factor_type !== undefined) body.two_factor_type = params.two_factor_type;
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson<
    | { user?: User; token?: string; error?: string }
    | (Requires2FAResponse & { user?: User; totp_setup?: { secret: string; qr_url: string } })
  >(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as AuthSession | (Requires2FAResponse & { user: User; totp_setup?: { secret: string; qr_url: string } });
}

export async function verify2FA(params: {
  tempToken: string;
  code: string;
  rememberDevice?: boolean;
  deviceId?: string;
}): Promise<AuthSession> {
  const res = await fetch(apiUrl('/api/auth/verify-2fa'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.tempToken}`,
    },
    body: JSON.stringify({
      code: params.code.replace(/\D/g, ''),
      rememberDevice: !!params.rememberDevice,
      deviceId: params.deviceId || undefined,
    }),
  });
  const data = await parseJson<{ user?: User; token?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as AuthSession;
}

export async function update2FA(params: {
  token: string;
  two_factor_enabled: boolean;
  two_factor_type?: 'email' | 'phone' | 'totp';
  current_password?: string;
}): Promise<{ user: User; totp_setup?: { secret: string; qr_url: string } }> {
  const body: Record<string, unknown> = { two_factor_enabled: params.two_factor_enabled };
  if (params.two_factor_type !== undefined) body.two_factor_type = params.two_factor_type;
  if (params.current_password !== undefined && params.current_password.length > 0) {
    body.current_password = params.current_password;
  }
  const res = await fetch(apiUrl('/api/auth/me/2fa'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ user?: User; totp_setup?: { secret: string; qr_url: string }; error?: string }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { user: User; totp_setup?: { secret: string; qr_url: string } };
}

export type CompleteProfilePayload = {
  first_name: string;
  last_name?: string;
  dob: string;
  phone?: string;
  email?: string;
  profile_picture?: string;
};

export type CompleteProfileResult = { user: User; token?: string };

export async function completeProfile(
  token: string,
  payload: CompleteProfilePayload
): Promise<CompleteProfileResult> {
  const res = await fetch(apiUrl('/api/auth/complete-profile'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<CompleteProfileResult & { error?: string }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as CompleteProfileResult;
}

export async function uploadProfilePhoto(token: string, formData: FormData): Promise<{ user: User }> {
  const res = await fetch(apiUrl('/api/auth/profile-photo'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await parseJson<{ user?: User; error?: string }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { user: User };
}

export async function updateProfile(
  token: string,
  data: { first_name?: string; last_name?: string; dob?: string | null }
): Promise<{ user: User }> {
  const res = await fetch(apiUrl('/api/auth/me'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const out = await parseJson<{ user?: User; error?: string }>(res);
  if (!res.ok) {
    throw new Error(out.error || res.statusText);
  }
  return { user: out.user! };
}

export async function updateAccount(
  token: string,
  params: {
    current_password: string;
    email?: string;
    phone?: string;
    new_password?: string;
    confirm_password?: string;
  }
): Promise<{ user: User }> {
  const res = await fetch(apiUrl('/api/auth/account'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const out = await parseJson<{ user?: User; error?: string }>(res);
  if (!res.ok) {
    throw new Error(out.error || res.statusText);
  }
  return { user: out.user! };
}

export async function getSessions(token: string): Promise<{ sessions: AuthSessionItem[] }> {
  const res = await fetch(apiUrl('/api/auth/sessions'), {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<{ sessions?: AuthSessionItem[]; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return { sessions: data.sessions ?? [] };
}

export async function revokeSession(token: string, sessionId: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/auth/sessions/${sessionId}`), {
    method: 'DELETE',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
}

export async function requestPasswordReset(params: {
  email?: string;
  phone?: string;
}): Promise<{ message: string }> {
  const res = await fetch(apiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: params.email?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
    }),
  });
  const data = await parseJson<{ message?: string; error?: string; retryAfterSec?: number }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return {
    message:
      (data as { message?: string }).message ||
      'If an account exists, a verification code has been sent or use your authenticator app if you use two-factor authentication.',
  };
}

export async function verifyForgotCode(params: {
  email?: string;
  phone?: string;
  code: string;
}): Promise<{ resetToken: string }> {
  const res = await fetch(apiUrl('/api/auth/verify-forgot-code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: params.email?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
      code: params.code.replace(/\D/g, ''),
    }),
  });
  const data = await parseJson<{ resetToken?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  const resetToken = (data as { resetToken?: string }).resetToken;
  if (!resetToken) {
    throw new Error('Invalid response from server');
  }
  return { resetToken };
}

export async function completeForgotPassword(params: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ message: string }> {
  const res = await fetch(apiUrl('/api/auth/complete-forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      resetToken: params.resetToken,
      new_password: params.newPassword,
      confirm_password: params.confirmPassword,
    }),
  });
  const data = await parseJson<{ message?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return { message: (data as { message?: string }).message || 'Your password has been updated.' };
}

export async function untrustSession(token: string, sessionId: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/auth/sessions/${sessionId}/untrust`), {
    method: 'PATCH',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
}
