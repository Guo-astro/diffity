import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as tauri from '@/lib/tauri';

export async function pickFolder(): Promise<string | null> {
  try {
    const selected = await open({ directory: true, multiple: false, title: 'Open repository' });
    return typeof selected === 'string' ? selected : null;
  } catch (error) {
    toast.error(api.errorMessage(error));
    return null;
  }
}

export function parsePrUrl(input: string): { owner: string; repo: string; number: number } | null {
  const match = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(input.trim());
  if (!match) {
    return null;
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, ''), number: Number(match[3]) };
}

export function remoteMatches(remoteUrl: string | null, owner: string, repo: string): boolean {
  if (!remoteUrl) {
    return false;
  }
  const normalized = remoteUrl.toLowerCase().replace(/\.git$/, '');
  return normalized.endsWith(`/${owner}/${repo}`.toLowerCase()) || normalized.endsWith(`:${owner}/${repo}`.toLowerCase());
}

/** The first of `paths` whose remote is the pull request's repository. */
export async function findLocalClone(paths: string[], pr: { owner: string; repo: string }): Promise<string | null> {
  for (const path of paths) {
    const remote = await tauri.repoRemoteUrl(path).catch(() => null);
    if (remoteMatches(remote, pr.owner, pr.repo)) {
      return path;
    }
  }
  return null;
}
