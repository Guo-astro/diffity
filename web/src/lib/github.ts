const API = 'https://api.github.com/repos/nilbuild/diffity';

export interface RepoStats {
  version: string | null;
  releaseUrl: string | null;
  stars: number | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`[github] ${url} answered ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[github] ${url} failed`, error);
    return null;
  }
}

/** Read once per build. Anything GitHub does not answer is left out of the page rather than failing the build. */
export async function getRepoStats(): Promise<RepoStats> {
  const [release, repo] = await Promise.all([
    getJson<{ tag_name: string; html_url: string }>(`${API}/releases/latest`),
    getJson<{ stargazers_count: number }>(API),
  ]);

  return {
    version: release?.tag_name ?? null,
    releaseUrl: release?.html_url ?? null,
    stars: repo?.stargazers_count ?? null,
  };
}

export function formatStars(stars: number) {
  if (stars < 1000) {
    return String(stars);
  }
  return `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
