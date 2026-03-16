//User shape returned by backend (GET /me, login, register, verify-2fa).
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

//AuthSession is the shape returned by the backend for the authentication session.
export interface AuthSession {
  user: User;
  token: string;
}

//Requires2FAResponse is the shape returned by the backend for the requires 2FA response.
export interface Requires2FAResponse {
  requires2FA: true;
  tempToken: string;
  twoFactorType: 'email' | 'phone' | 'totp';
}

// Session list item from GET /api/auth/sessions
export interface AuthSessionItem {
  id: number;
  session_token: string;
  device_name: string;
  is_trusted_device: boolean;
  expires_at: string;
  current: boolean;
}
