import type { DiffFile } from '@/lib/diff-parser';
import type { ViewedFile } from './types';
import { hashString } from './hash';

export interface ChangedSinceViewed {
  /** A snapshot of the viewed version exists, so the changes since then can be shown. */
  canDiff: boolean;
}

export interface ViewedState {
  reviewed: Set<string>;
  changed: Map<string, ChangedSinceViewed>;
}

export function fileHash(file: DiffFile): string {
  const parts: string[] = [file.status, file.oldPath, file.newPath];
  for (const hunk of file.hunks) {
    parts.push(hunk.header);
    for (const line of hunk.lines) {
      parts.push(line.type, line.content);
    }
  }
  return hashString(parts.join('\n'));
}

/**
 * Splits stored viewed marks against the current diff: a file is viewed while its diff still matches the one marked,
 * and "changed since viewed" once it differs. Marks for files no longer in the diff count as neither.
 */
export function computeViewedState(entries: ViewedFile[], hashes: Map<string, string>): ViewedState {
  const reviewed = new Set<string>();
  const changed = new Map<string, ChangedSinceViewed>();
  for (const entry of entries) {
    const current = hashes.get(entry.filePath);
    if (current === undefined) {
      continue;
    }
    if (current === entry.contentHash) {
      reviewed.add(entry.filePath);
      continue;
    }
    changed.set(entry.filePath, { canDiff: !!entry.blobId });
  }
  return { reviewed, changed };
}

export function viewedSummary(viewed: number, changed: number, total: number): string {
  const base = viewed === total && total > 0 ? 'All files viewed' : `${viewed} of ${total} files viewed`;
  if (changed === 0) {
    return base;
  }
  return `${base} · ${changed} changed since viewed`;
}
