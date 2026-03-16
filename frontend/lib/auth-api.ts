//Auth API calls. Use with API_BASE; responses match backend.
import { apiUrl } from '@/lib/api'; // Import the apiUrl function from the api.ts file
import type { AuthSession, AuthSessionItem, Requires2FAResponse, User } from '@/lib/auth-types'; // Import the auth types from the auth-types.ts file

// Parse the JSON response from the API
function parseJson<T>(res: Response): Promise<T> {
  // Return the JSON response from the API
  return res.json() as Promise<T>;
}

// Login function to login the user
export async function login(params: {
  email?: string; // Email of the user
  phone?: string; // Phone of the user
  password: string; // Password of the user
  staySignedIn?: boolean; // Whether to stay signed in
  deviceId?: string; // Device ID of the user
}): Promise<{ user: User; token: string } | Requires2FAResponse> { // Promise to return the user and token or the requires 2FA response
  // Try to fetch the login endpoint
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST', // POST request to the login endpoint
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, // Headers for the request
    body: JSON.stringify({ 
      email: params.email?.trim() || undefined, // Email of the user
      phone: params.phone?.trim() || undefined, // Phone of the user
      password: params.password, // Password of the user
      staySignedIn: !!params.staySignedIn, // Whether to stay signed in
      deviceId: params.deviceId || undefined, // Device ID of the user
    }),
  });
  // Parse the response as a user and token or the requires 2FA response
  const data = await parseJson<{ user?: User; token?: string; requires2FA?: boolean; tempToken?: string; twoFactorType?: string }>(res);
  // If the response is not successful, throw an error
  if (!res.ok) {
    const err = (data as { error?: string }).error || res.statusText; // Error message from the response
    throw new Error(err); // Throw an error with the error message
  }
  // If the response requires 2FA, return the requires 2FA response
  if ((data as Requires2FAResponse).requires2FA && (data as Requires2FAResponse).tempToken) {
    return data as Requires2FAResponse; // Return the requires 2FA response
  }
  return data as AuthSession; // Return the user and token
}

// Register function to register the user
export async function register(params: {
  email?: string; // Email of the user
  phone?: string; // Phone of the user
  password: string; // Password of the user
  deviceId?: string; // Device ID of the user
  two_factor_enabled?: boolean; // Whether to enable 2FA
  two_factor_type?: 'email' | 'phone' | 'totp'; // Type of 2FA
}): Promise<AuthSession | (Requires2FAResponse & { user: User; totp_setup?: { secret: string; qr_url: string } })> { // Promise to return the user and token or the requires 2FA response
  const body: Record<string, unknown> = {
    email: params.email?.trim() || undefined, // Email of the user
    phone: params.phone?.trim() || undefined, // Phone of the user
    password: params.password, // Password of the user
    deviceId: params.deviceId || undefined, // Device ID of the user
  };
  if (params.two_factor_enabled !== undefined) body.two_factor_enabled = params.two_factor_enabled; // Whether to enable 2FA
  if (params.two_factor_type !== undefined) body.two_factor_type = params.two_factor_type; // Type of 2FA
  // Try to fetch the register endpoint
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST', // POST request to the register endpoint
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, // Headers for the request
    body: JSON.stringify(body), // Body of the request
  });
  // Parse the response as a user and token or the requires 2FA response
  const data = await parseJson<
    | { user?: User; token?: string; error?: string } // User and token or error
    | (Requires2FAResponse & { user?: User; totp_setup?: { secret: string; qr_url: string } }) // Requires 2FA response and user and totp setup
  >(res);
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText); // Throw an error with the error message
  }
  return data as AuthSession | (Requires2FAResponse & { user: User; totp_setup?: { secret: string; qr_url: string } }); // Return the user and token or the requires 2FA response
}

// Verify 2FA function to verify the 2FA code
export async function verify2FA(params: {
  tempToken: string; // Temp token for the 2FA
  code: string; // Code for the 2FA
  rememberDevice?: boolean; // Whether to remember the device
  deviceId?: string; // Device ID of the user
}): Promise<AuthSession> { // Promise to return the user and token
  const res = await fetch(apiUrl('/api/auth/verify-2fa'), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', // Content type header for the request
      Accept: 'application/json', // Accept header for the request
      Authorization: `Bearer ${params.tempToken}`, // Authorization header with the temp token
    },
    body: JSON.stringify({
      code: params.code.replace(/\D/g, ''), // Code for the 2FA
      rememberDevice: !!params.rememberDevice, // Whether to remember the device
      deviceId: params.deviceId || undefined, // Device ID of the user
    }),
  });
  const data = await parseJson<{ user?: User; token?: string; error?: string }>(res); // Parse the response as a user and token or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText); // Throw an error with the error message
  }
  return data as AuthSession; // Return the user and token
}

// Update 2FA function to update the 2FA settings
export async function update2FA(params: {
  token: string; // Token for the 2FA
  two_factor_enabled: boolean; // Whether to enable 2FA
  two_factor_type?: 'email' | 'phone' | 'totp'; // Type of 2FA
  current_password?: string; // Current password of the user
}): Promise<{ user: User; totp_setup?: { secret: string; qr_url: string } }> { // Promise to return the user and totp setup
  const body: Record<string, unknown> = { two_factor_enabled: params.two_factor_enabled }; // Body of the request
  if (params.two_factor_type !== undefined) body.two_factor_type = params.two_factor_type; // Type of 2FA
  if (params.current_password !== undefined && params.current_password.length > 0) body.current_password = params.current_password; // Current password of the user
  //Fetch the update 2FA endpoint
  const res = await fetch(apiUrl('/api/auth/me/2fa'), {
    method: 'PATCH', // PATCH request to the update 2FA endpoint
    headers: {
      'Content-Type': 'application/json', // Content type header for the request
      Accept: 'application/json', // Accept header for the request
      Authorization: `Bearer ${params.token}`, // Authorization header with the token
    },
    body: JSON.stringify(body), // Body of the request
  });
  const data = await parseJson<{ user?: User; totp_setup?: { secret: string; qr_url: string }; error?: string }>(res); // Parse the response as a user and totp setup or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText); // Throw an error with the error message
  }
  return data as { user: User; totp_setup?: { secret: string; qr_url: string } }; // Return the user and totp setup
}

// Complete profile payload type
export type CompleteProfilePayload = {
  first_name: string; // First name of the user
  last_name?: string; // Last name of the user
  dob: string; // Date of birth of the user
  phone?: string; // Phone of the user
  email?: string; // Email of the user
  profile_picture?: string; // Profile picture of the user
};

// Complete profile result type
export type CompleteProfileResult = { user: User; token?: string };

// Complete profile function to complete the profile of the user
export async function completeProfile(
  token: string, // Token for the user
  payload: CompleteProfilePayload // Payload for the complete profile
): Promise<CompleteProfileResult> { // Promise to return the complete profile result
  // Try to fetch the complete profile endpoint
  const res = await fetch(apiUrl('/api/auth/complete-profile'), {
    method: 'POST', // POST request to the complete profile endpoint
    headers: {
      'Content-Type': 'application/json', // Content type header for the request
      Accept: 'application/json', // Accept header for the request
      Authorization: `Bearer ${token}`, // Authorization header with the token
    },
    body: JSON.stringify(payload), // Body of the request
  });
  const data = await parseJson<CompleteProfileResult & { error?: string }>(res); // Parse the response as a complete profile result or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText); // Throw an error with the error message
  }
  return data as CompleteProfileResult; // Return the complete profile result
}

// Upload profile photo function to upload the profile photo of the user
export async function uploadProfilePhoto(
  token: string, // Token for the user
  imageUri: string, // Image URI of the profile photo
  fileName: string = 'photo.jpg', // File name of the profile photo
  mimeType: string = 'image/jpeg' // MIME type of the profile photo
): Promise<{ user: User }> { // Promise to return the user with the profile photo
  // Create a form data object
  const formData = new FormData();
  formData.append('photo', { // Append the profile photo to the form data
    uri: imageUri, // URI of the profile photo
    name: fileName, // File name of the profile photo
    type: mimeType, // MIME type of the profile photo
  } as unknown as Blob);
  // Try to fetch the upload profile photo endpoint
  const res = await fetch(apiUrl('/api/auth/profile-photo'), {
    method: 'POST', // POST request to the upload profile photo endpoint
    headers: {
      Accept: 'application/json', // Accept header for the request
      Authorization: `Bearer ${token}`, // Authorization header with the token
    },
    body: formData, // Body of the request
  });
  const data = await parseJson<{ user?: User; error?: string }>(res); // Parse the response as a user or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText); // Throw an error with the error message
  }
  return data as { user: User };
}

// Update profile function to update the profile of the user
export async function updateProfile(
  token: string, // Token for the user
  data: { first_name?: string; last_name?: string; dob?: string | null } // Data for the update profile
): Promise<{ user: User }> { // Promise to return the user with the updated profile
  //Fetch the update profile endpoint
  const res = await fetch(apiUrl('/api/auth/me'), {
    method: 'PATCH', // PATCH request to the update profile endpoint
    headers: {
      'Content-Type': 'application/json', // Content type header for the request
      Accept: 'application/json', // Accept header for the request
      Authorization: `Bearer ${token}`, // Authorization header with the token
    },
    body: JSON.stringify(data), // Body of the request
  });
  const out = await parseJson<{ user?: User; error?: string }>(res); // Parse the response as a user or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(out.error || res.statusText); // Throw an error with the error message
  }
  return { user: out.user! }; // Return the user with the updated profile
}

// Update account function to update the account of the user(email, phone, or password)
export async function updateAccount(
  token: string, // Token for the user
  params: {
    current_password: string; // Current password of the user
    email?: string; // Email of the user
    phone?: string; // Phone of the user
    new_password?: string; // New password of the user
    confirm_password?: string; // Confirm password of the user
  }
): Promise<{ user: User }> { // Promise to return the user with the updated account
  //Fetch the update account endpoint
  const res = await fetch(apiUrl('/api/auth/account'), {
    method: 'PATCH', // PATCH request to the update account endpoint
    headers: {
      'Content-Type': 'application/json', // Content type header for the request
      Accept: 'application/json', // Accept header for the request
      Authorization: `Bearer ${token}`, // Authorization header with the token
    },
    body: JSON.stringify(params), // Body of the request
  });
  const out = await parseJson<{ user?: User; error?: string }>(res); // Parse the response as a user or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(out.error || res.statusText); // Throw an error with the error message
  }
  return { user: out.user! }; // Return the user with the updated account
}

// Get sessions function to get the sessions of the user
export async function getSessions(token: string): Promise<{ sessions: AuthSessionItem[] }> { // Promise to return the sessions of the user
  //Fetch the get sessions endpoint
  const res = await fetch(apiUrl('/api/auth/sessions'), {
    method: 'GET', // GET request to the get sessions endpoint
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, // Headers for the request
  });
  const data = await parseJson<{ sessions?: AuthSessionItem[]; error?: string }>(res); // Parse the response as a sessions or the error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
  return { sessions: data.sessions ?? [] }; // Return the sessions of the user
}

// Revoke session function to revoke a specific session of the user
export async function revokeSession(token: string, sessionId: number): Promise<void> { // Promise to return void
  //Fetch the revoke session endpoint
  const res = await fetch(apiUrl(`/api/auth/sessions/${sessionId}`), {
    method: 'DELETE', // DELETE request to the revoke session endpoint
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, // Headers for the request
  });
  const data = await parseJson<{ error?: string }>(res); // Parse the response as an error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
}

// Untrust session function to untrust a specific session of the user
export async function untrustSession(token: string, sessionId: number): Promise<void> { // Promise to return void
  //Fetch the untrust session endpoint
  const res = await fetch(apiUrl(`/api/auth/sessions/${sessionId}/untrust`), {
    method: 'PATCH', // PATCH request to the untrust session endpoint
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, // Headers for the request
  });
  const data = await parseJson<{ error?: string }>(res); // Parse the response as an error
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
}
