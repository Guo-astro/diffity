import { create } from 'zustand';
import { RELEASES_API, releasesFrom, type Release } from '../../whats-new';

export type ReleasesRead = { kind: 'loading' } | { kind: 'loaded'; releases: Release[] } | { kind: 'failed' };

export const useReleases = create<ReleasesRead>(() => ({ kind: 'loading' }));

/** Reads the releases once a session; a failure is asked again on the next opening. */
export async function loadReleases() {
  if (useReleases.getState().kind === 'loaded') {
    return;
  }
  useReleases.setState({ kind: 'loading' }, true);
  try {
    const response = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) {
      useReleases.setState({ kind: 'failed' }, true);
      return;
    }
    const releases = releasesFrom(await response.json());
    useReleases.setState(releases.length ? { kind: 'loaded', releases } : { kind: 'failed' }, true);
  } catch {
    useReleases.setState({ kind: 'failed' }, true);
  }
}
