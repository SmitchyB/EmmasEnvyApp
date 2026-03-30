// Portfolio API calls. Use with API_BASE; responses match backend /api/portfolios.
import { apiUrl, fetchWithAuth } from '@/lib/api';

// Defines the PortfolioPhoto type
export type PortfolioPhoto = {
  id: number; // The id of the portfolio photo
  portfolio_id: number; // The id of the portfolio
  url: string | null; // The url of the portfolio photo
  caption: string | null; // The caption of the portfolio photo
  sort_order: number; // The sort order of the portfolio photo
  created_at: string; // The created at date of the portfolio photo
  updated_at: string; // The updated at date of the portfolio photo
};
// Defines the Portfolio type
export type Portfolio = {
  id: number; // The id of the portfolio
  employee_id: number | null; // The id of the employee
  description: string | null; // The description of the portfolio
  visible: boolean; // The visibility of the portfolio
  name: string | null; // The name of the portfolio
  portrait: string | null; // The portrait of the portfolio
  created_at: string; // The created at date of the portfolio
  updated_at: string; // The updated at date of the portfolio
  photos?: PortfolioPhoto[]; // The photos of the portfolio
};
// Defines the parseJson function
function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>; // Return the JSON response from the API as a Promise of the T type
}
// Defines the getPortfolios function
export async function getPortfolios(): Promise<{ portfolios: Portfolio[] }> {
  // Fetch the portfolios from the API
  const res = await fetch(apiUrl('/api/portfolios'), {
    method: 'GET', // Get the portfolios from the API
    headers: { Accept: 'application/json' }, // Accept the JSON response from the API
  });
  const data = await parseJson<{ portfolios?: Portfolio[]; error?: string }>(res); // Parse the JSON response from the API as a Promise of the { portfolios?: Portfolio[]; error?: string } type
  // If the response is not ok, throw an error with the error message or the status text
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
  return { portfolios: data.portfolios ?? [] }; // Return the portfolios from the API as a Promise of the { portfolios: Portfolio[] } type
}
// Defines the getPortfolioById function
export async function getPortfolioById(id: number): Promise<{ portfolio: Portfolio & { photos: PortfolioPhoto[] } }> {
  // Fetch the portfolio from the API
  const res = await fetch(apiUrl(`/api/portfolios/${id}`), {
    method: 'GET', // Get the portfolio from the API
    headers: { Accept: 'application/json' }, // Accept the JSON response from the API
  });
  const data = await parseJson<{ portfolio?: Portfolio & { photos?: PortfolioPhoto[] }; error?: string }>(res); // Parse the JSON response from the API as a Promise of the { portfolio?: Portfolio & { photos?: PortfolioPhoto[] }; error?: string } type
  // If the response is not ok, throw an error with the error message or the status text
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
  const portfolio = data.portfolio; // Set the portfolio state to the portfolio from the API
  // If the portfolio is not found, throw an error with the error message
  if (!portfolio) {
    throw new Error('Portfolio not found'); // Throw an error with the error message
  }
  return { portfolio: { ...portfolio, photos: portfolio.photos ?? [] } }; // Return the portfolio from the API as a Promise of the { portfolio: Portfolio & { photos: PortfolioPhoto[] } } type
}
// Defines the getMyPortfolio function
export async function getMyPortfolio(
  token: string | null | undefined // The token for the user
): Promise<{ portfolio: (Portfolio & { photos: PortfolioPhoto[] }) | null }> {
  // Fetch the my portfolio from the API
  const res = await fetchWithAuth(
    apiUrl('/api/portfolios/me'), // Get the my portfolio from the API
    {
      method: 'GET', // Get the my portfolio from the API
      headers: { Accept: 'application/json' }, // Accept the JSON response from the API
    },
    token // The token for the user
  );
  // If the response is not ok, throw an error with the error message or the status text
  if (res.status === 404) {
    return { portfolio: null }; // Return the portfolio from the API as a Promise of the { portfolio: null } type
  }
  // Parse the JSON response from the API as a Promise of the { portfolio?: Portfolio & { photos?: PortfolioPhoto[] }; error?: string } type
  const data = await parseJson<{
    portfolio?: Portfolio & { photos?: PortfolioPhoto[] }; // The portfolio from the API
    error?: string; // The error message from the API
  }>(res);
  // If the response is not ok, throw an error with the error message or the status text
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
  const portfolio = data.portfolio; // Set the portfolio state to the portfolio from the API
  // If the portfolio is not found, return the portfolio from the API as a Promise of the { portfolio: null } type
  if (!portfolio) {
    return { portfolio: null }; // Return the portfolio from the API as a Promise of the { portfolio: null } type
  }
  return { portfolio: { ...portfolio, photos: portfolio.photos ?? [] } }; // Return the portfolio from the API as a Promise of the { portfolio: Portfolio & { photos: PortfolioPhoto[] } } type
}
// Defines the saveMyPortfolio function
export async function saveMyPortfolio(
  token: string | null | undefined, // The token for the user
  body: {
    name?: string | null; // The name of the portfolio
    description?: string | null; // The description of the portfolio
    visible?: boolean; // The visibility of the portfolio
  }
): Promise<{ portfolio: Portfolio & { photos: PortfolioPhoto[] } }> {
  // Fetch the my portfolio from the API
  const res = await fetchWithAuth(
    apiUrl('/api/portfolios/me'), // Get the my portfolio from the API
    {
      method: 'POST', // Post the my portfolio to the API
      headers: {
        'Content-Type': 'application/json', // Content type of the request
        Accept: 'application/json', // Accept the JSON response from the API
      },
      body: JSON.stringify(body), // Body of the request
    },
    token // The token for the user
  );
  const data = await parseJson<{
    portfolio?: Portfolio & { photos?: PortfolioPhoto[] }; // The portfolio from the API
    error?: string; // The error message from the API
  }>(res);
  // If the response is not ok, throw an error with the error message or the status text
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
  const portfolio = data.portfolio; // Set the portfolio state to the portfolio from the API
  // If the portfolio is not found, throw an error with the error message
  if (!portfolio) {
    throw new Error('Portfolio not found'); // Throw an error with the error message
  }
  return { portfolio: { ...portfolio, photos: portfolio.photos ?? [] } }; // Return the portfolio from the API as a Promise of the { portfolio: Portfolio & { photos: PortfolioPhoto[] } } type
}

// Defines the uploadPortfolioPhoto function
export async function uploadPortfolioPhoto(
  token: string | null | undefined, // The token for the user
  imageUri: string, // The image uri of the portfolio photo
  fileName: string = 'portfolio-photo.jpg', // The file name of the portfolio photo
  mimeType: string = 'image/jpeg' // The mime type of the portfolio photo
): Promise<{ photo: PortfolioPhoto }> {
  const formData = new FormData(); // Create a new form data object
  formData.append(
    'photo', // Append the portfolio photo to the form data
    {
      uri: imageUri, // URI of the portfolio photo
      name: fileName, // File name of the portfolio photo
      type: mimeType, // MIME type of the portfolio photo
    } as unknown as Blob // Blob of the portfolio photo   
  );
  // Fetch the portfolio photo from the API
  const res = await fetchWithAuth(
    apiUrl('/api/portfolios/me/photos'), // Post the portfolio photo to the API
    {
      method: 'POST', // Post the portfolio photo to the API
      headers: {
        Accept: 'application/json', // Accept the JSON response from the API
      },
      body: formData, // Body of the request
    },
    token // The token for the user
  );
  const data = await parseJson<{ photo?: PortfolioPhoto; error?: string }>(res); // Parse the JSON response from the API as a Promise of the { photo?: PortfolioPhoto; error?: string } type
  // If the response is not ok, throw an error with the error message or the status text
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
  // If the photo is not found, throw an error with the error message
  if (!data.photo) {
    throw new Error('Photo not returned from server'); // Throw an error with the error message
  }
  return { photo: data.photo }; // Return the portfolio photo from the API as a Promise of the { photo: PortfolioPhoto } type
}
// Defines the updatePortfolioPhoto function
export async function updatePortfolioPhoto(
  token: string | null | undefined, // The token for the user
  photoId: number, // The id of the portfolio photo
  body: { caption?: string | null; sort_order?: number } // The body of the request
): Promise<{ photo: PortfolioPhoto }> {
  // Fetch the portfolio photo from the API
  const res = await fetchWithAuth(
    apiUrl(`/api/portfolios/me/photos/${photoId}`), // Patch the portfolio photo to the API
    {
      method: 'PATCH', // Patch the portfolio photo to the API
      headers: {
        'Content-Type': 'application/json', // Content type of the request
        Accept: 'application/json', // Accept the JSON response from the API
      },
      body: JSON.stringify(body), // Body of the request
    },
    token
  );
  const data = await parseJson<{ photo?: PortfolioPhoto; error?: string }>(res); // Parse the JSON response from the API as a Promise of the { photo?: PortfolioPhoto; error?: string } type
  // If the response is not ok, throw an error with the error message or the status text
  if (!res.ok) {
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
  // If the photo is not found, throw an error with the error message
  if (!data.photo) {
    throw new Error('Photo not returned from server'); // Throw an error with the error message
  }
  return { photo: data.photo }; // Return the portfolio photo from the API as a Promise of the { photo: PortfolioPhoto } type
}
// Defines the deletePortfolioPhoto function
export async function deletePortfolioPhoto(
  token: string | null | undefined, // The token for the user
  photoId: number // The id of the portfolio photo
): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/portfolios/me/photos/${photoId}`), // Delete the portfolio photo from the API
    {
      method: 'DELETE', // Delete the portfolio photo from the API
      headers: { Accept: 'application/json' }, // Accept the JSON response from the API
    },
    token // The token for the user
  );
  // Fetch the portfolio photo from the API
  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res); // Parse the JSON response from the API as a Promise of the { error?: string } type
    throw new Error(data.error || res.statusText); // Throw an error with the error message or the status text
  }
}
