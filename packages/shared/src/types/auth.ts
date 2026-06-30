export interface User {
  id: number;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
  profile_picture: string | null;
  email: string | null;
  role: string;
  two_factor_type: string | null;
  two_factor_enabled: boolean;
  status: string;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
  reward_points: number;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface Requires2FAResponse {
  requires2FA: true;
  tempToken: string;
  twoFactorType: 'email' | 'phone' | 'totp';
}

export interface AuthSessionItem {
  id: number;
  session_token: string;
  device_name: string;
  is_trusted_device: boolean;
  expires_at: string;
  current: boolean;
}
