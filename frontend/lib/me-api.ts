// API helpers for /api/me (addresses). Requires auth token.
import { apiUrl, fetchWithAuth } from '@/lib/api';

// Defines the parse json function
function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>; // Return the JSON response from the API
}
// Defines the user address interface
export interface UserAddress {
  id: number;
  full_name: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state_province: string;
  zip_postal_code: string;
  country: string | null;
  phone: string | null;
  created_at: string;
  updated_at?: string;
}

// Defines the get addresses function
export async function getAddresses(token: string | null | undefined): Promise<UserAddress[]> { // Promise to return the user addresses
  const res = await fetchWithAuth(apiUrl('/api/me/addresses'), { method: 'GET', headers: { Accept: 'application/json' } }, token); // Fetch the addresses from the API
  const data = await parseJson<{ addresses?: UserAddress[]; error?: string }>(res); // Parse the JSON response from the API
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
  return data.addresses ?? []; // Return the user addresses
}

// Defines the create address function
export async function createAddress(
  token: string | null | undefined, // Token for the user
  body: { // Body of the request
    full_name: string; // Full name of the user
    address_line_1: string; // Address line 1 of the user
    address_line_2?: string; // Address line 2 of the user
    city: string; // City of the user
    state_province: string; // State/province of the user
    zip_postal_code: string; // Zip/postal code of the user
    country: string; // Country of the user
    phone?: string; // Phone of the user
  }): Promise<UserAddress> { // Promise to return the user address
  // Fetch the create address endpoint
  const res = await fetchWithAuth(
    apiUrl('/api/me/addresses'),
    {
      method: 'POST', // POST request to the create address endpoint
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, // Headers for the request
      body: JSON.stringify(body), // Body of the request
    },
    token // Token for the user
  );
  const data = await parseJson<{ address?: UserAddress; error?: string }>(res); // Parse the JSON response from the API
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
  return data.address!; // Return the user address
}

// Defines the update address function
export async function updateAddress(
  token: string | null | undefined, // Token for the user
  id: number, // ID of the address
  body: { // Body of the request
    full_name: string; // Full name of the user
    address_line_1: string; // Address line 1 of the user
    address_line_2?: string; // Address line 2 of the user
    city: string; // City of the user
    state_province: string; // State/province of the user
    zip_postal_code: string; // Zip/postal code of the user
    country: string; // Country of the user
    phone?: string; // Phone of the user
  }): Promise<UserAddress> { // Promise to return the user address
  const res = await fetchWithAuth(
    apiUrl(`/api/me/addresses/${id}`),
    {
      method: 'PATCH', // PATCH request to the update address endpoint
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, // Headers for the request
      body: JSON.stringify(body), // Body of the request
    },
    token // Token for the user
  );
  const data = await parseJson<{ address?: UserAddress; error?: string }>(res); // Parse the JSON response from the API
  // If the response is not successful, throw an error
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
  return data.address!; // Return the user address
}

// Defines the delete address function
export async function deleteAddress(token: string | null | undefined, id: number): Promise<void> { // Promise to return void
  // Fetch the delete address endpoint
  const res = await fetchWithAuth(apiUrl(`/api/me/addresses/${id}`), { method: 'DELETE', headers: { Accept: 'application/json' } }, token); // Fetch the delete address endpoint
  // If the response is not successful, throw an error
  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res); // Parse the JSON response from the API
    throw new Error(data.error || res.statusText); // Throw an error with the error message
  }
}
