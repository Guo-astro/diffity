import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as tauri from '../../lib/tauri';
import { parseGitHubRemote } from '../../lib/api';
import { useGitHubAuth } from '../../hooks/use-repo-state';
import { groupInbox, type InboxItem } from './inbox';

/** Search has tighter rate limits than the rest of the API, so the inbox refreshes at most this often. */
const REFRESH_MS = 2 * 60_000;

export function usePrInbox(enabled = true) {
  const auth = useGitHubAuth();
  const signedIn = auth.data?.authenticated === true;
  const query = useQuery({
    queryKey: ['pr-inbox'],
    queryFn: tauri.prInbox,
    enabled: enabled && signedIn,
    staleTime: REFRESH_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const items = useMemo<InboxItem[]>(() => (query.data ? groupInbox(query.data) : []), [query.data]);

  return {
    authKnown: !auth.isLoading,
    signedIn,
    items,
    loading: signedIn && query.isLoading,
    error: query.error ? tauri.errorMessage(query.error) : null,
    updatedAt: query.dataUpdatedAt,
    refresh: () => void query.refetch(),
  };
}

/** `owner/repo` (lower case) → a clone you've opened before, so rows can say where the PR will open. */
export function useLocalClones(): Map<string, string> {
  const { data: recent } = useQuery({ queryKey: ['recent-repos'], queryFn: tauri.recentRepos });
  const paths = (recent ?? []).map((repo) => repo.path);
  const { data } = useQuery({
    queryKey: ['recent-remotes', paths],
    queryFn: async () => {
      const remotes = await Promise.all(paths.map((path) => tauri.repoRemoteUrls(path).catch(() => [])));
      const clones = new Map<string, string>();
      remotes.forEach((urls, index) => {
        for (const url of urls) {
          const remote = parseGitHubRemote(url);
          const key = remote ? `${remote.owner}/${remote.repo}`.toLowerCase() : null;
          if (key && !clones.has(key)) {
            clones.set(key, paths[index]);
          }
        }
      });
      return clones;
    },
    enabled: paths.length > 0,
    staleTime: 5 * 60_000,
  });
  return data ?? new Map();
}
