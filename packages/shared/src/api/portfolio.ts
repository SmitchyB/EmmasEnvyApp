import { apiUrl } from '../config';
import { fetchWithAuth } from './client';
import { parseJson } from '../utils/http';
import type { Portfolio, PortfolioPhoto } from '../types/portfolio';

export async function getPrimaryPortfolio(): Promise<{
  portfolio: Portfolio & { photos: PortfolioPhoto[] };
} | null> {
  const res = await fetch(apiUrl('/api/portfolios/primary'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  const data = await parseJson<{ portfolio?: Portfolio & { photos?: PortfolioPhoto[] }; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || res.statusText);
  const portfolio = data.portfolio;
  if (!portfolio) return null;
  return { portfolio: { ...portfolio, photos: portfolio.photos ?? [] } };
}

export async function getMyPortfolio(
  token: string | null | undefined
): Promise<{ portfolio: (Portfolio & { photos: PortfolioPhoto[] }) | null }> {
  const res = await fetchWithAuth(
    apiUrl('/api/portfolios/me'),
    { method: 'GET', headers: { Accept: 'application/json' } },
    token
  );
  if (res.status === 404) return { portfolio: null };
  const data = await parseJson<{
    portfolio?: Portfolio & { photos?: PortfolioPhoto[] };
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error || res.statusText);
  const portfolio = data.portfolio;
  if (!portfolio) return { portfolio: null };
  return { portfolio: { ...portfolio, photos: portfolio.photos ?? [] } };
}

export async function saveMyPortfolio(
  token: string | null | undefined,
  body: { visible?: boolean }
): Promise<{ portfolio: Portfolio & { photos: PortfolioPhoto[] } }> {
  const res = await fetchWithAuth(
    apiUrl('/api/portfolios/me'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  const data = await parseJson<{
    portfolio?: Portfolio & { photos?: PortfolioPhoto[] };
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error || res.statusText);
  const portfolio = data.portfolio;
  if (!portfolio) throw new Error('Portfolio not found');
  return { portfolio: { ...portfolio, photos: portfolio.photos ?? [] } };
}

export async function uploadPortfolioPhoto(
  token: string | null | undefined,
  formData: FormData
): Promise<{ photo: PortfolioPhoto }> {
  const res = await fetchWithAuth(
    apiUrl('/api/portfolios/me/photos'),
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    },
    token
  );
  const data = await parseJson<{ photo?: PortfolioPhoto; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (!data.photo) throw new Error('Photo not returned from server');
  return { photo: data.photo };
}

export async function updatePortfolioPhoto(
  token: string | null | undefined,
  photoId: number,
  body: { caption?: string | null; sort_order?: number }
): Promise<{ photo: PortfolioPhoto }> {
  const res = await fetchWithAuth(
    apiUrl(`/api/portfolios/me/photos/${photoId}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );
  const data = await parseJson<{ photo?: PortfolioPhoto; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (!data.photo) throw new Error('Photo not returned from server');
  return { photo: data.photo };
}

export async function deletePortfolioPhoto(
  token: string | null | undefined,
  photoId: number
): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/portfolios/me/photos/${photoId}`),
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    token
  );
  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res);
    throw new Error(data.error || res.statusText);
  }
}
