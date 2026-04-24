export interface FetchedJdResult {
  id: string;
  url: string;
  title: string;
  text: string;
  createdAt: string;
  expiresAt: string;
}

async function parseJsonResponse(response: Response): Promise<{ error?: string }> {
  try {
    return await response.json() as { error?: string };
  } catch {
    return {};
  }
}

export async function fetchJdFromUrl(url: string): Promise<FetchedJdResult> {
  const response = await fetch('/api/jd/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    throw new Error(body.error || 'Failed to fetch the job description from this URL.');
  }

  return response.json() as Promise<FetchedJdResult>;
}

export async function clearFetchedJd(id: string): Promise<void> {
  await fetch(`/api/jd/fetch/${id}`, {
    method: 'DELETE',
  });
}
