import type { PullRequest } from './types';

type PrBase = Pick<PullRequest, 'baseRef'> & { baseRemote?: string | null };

/** The PR's base branch on the remote its pull requests live on, e.g. `upstream/main` in a fork setup. */
export function prBaseFor(pr: PrBase): string {
  return `${pr.baseRemote ?? 'origin'}/${pr.baseRef}`;
}

/** The view a checked-out pull request is reviewed in: its commits on top of the base. */
export function prRefFor(pr: PrBase): string {
  return `${prBaseFor(pr)}...HEAD`;
}
