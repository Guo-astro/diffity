import type { RepoThread } from './types';
import { GENERAL_THREAD_FILE_PATH } from '../components/comments/types';

export interface ViewGroup {
  /** Unique per view: the same ref on another branch is a separate group. */
  key: string;
  ref: string;
  /** Set for a PR or branch view of a branch other than the checked-out one. */
  otherBranch?: string;
  label: string;
  latest: string;
  files: { path: string; threads: RepoThread[] }[];
  count: number;
}

/** Groups threads by view (current view first, then most recently active) and by file (general first). */
export function groupThreads(threads: RepoThread[], currentRef: string | null): ViewGroup[] {
  const byRef = new Map<string, { ref: string; otherBranch?: string; label: string; latest: string; threads: RepoThread[] }>();
  for (const thread of threads) {
    const key = thread.otherBranch ? `${thread.ref}\n${thread.otherBranch}` : thread.ref;
    const group = byRef.get(key);
    if (!group) {
      byRef.set(key, { ref: thread.ref, otherBranch: thread.otherBranch, label: thread.refLabel, latest: thread.updatedAt, threads: [thread] });
      continue;
    }
    group.threads.push(thread);
    if (thread.updatedAt > group.latest) {
      group.latest = thread.updatedAt;
    }
  }
  const groups: ViewGroup[] = [];
  for (const [key, group] of byRef) {
    const byFile = new Map<string, RepoThread[]>();
    for (const thread of group.threads) {
      const list = byFile.get(thread.filePath) ?? [];
      list.push(thread);
      byFile.set(thread.filePath, list);
    }
    const files = [...byFile.entries()]
      .sort(([a], [b]) => {
        if (a === GENERAL_THREAD_FILE_PATH) {
          return -1;
        }
        if (b === GENERAL_THREAD_FILE_PATH) {
          return 1;
        }
        return a.localeCompare(b);
      })
      .map(([path, list]) => ({ path, threads: list.sort((x, y) => x.startLine - y.startLine) }));
    groups.push({ key, ref: group.ref, otherBranch: group.otherBranch, label: group.label, latest: group.latest, files, count: group.threads.length });
  }
  const isCurrent = (group: ViewGroup) => group.ref === currentRef && !group.otherBranch;
  return groups.sort((a, b) => {
    if (isCurrent(a)) {
      return -1;
    }
    if (isCurrent(b)) {
      return 1;
    }
    return b.latest.localeCompare(a.latest);
  });
}
