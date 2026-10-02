import { GENERAL_THREAD_FILE_PATH, type CommentThread } from '../components/comments/types';

/**
 * Splits a branch review's threads into those placeable in the view `viewRef` and those left in its other mode
 * (`main` vs `main...HEAD`) that can't be: their file isn't in this diff, or they sit on the new side of a file
 * with uncommitted changes, where the two modes number lines differently. `uncommittedPaths` is null while unknown.
 */
export function splitThreadsByView(
  threads: CommentThread[],
  viewRef: string,
  diffPaths: Set<string>,
  uncommittedPaths: Set<string> | null,
): { here: CommentThread[]; elsewhere: CommentThread[] } {
  const elsewhere = threads.filter((thread) => {
    if (!thread.viewRef || thread.viewRef === viewRef || thread.filePath === GENERAL_THREAD_FILE_PATH) {
      return false;
    }
    if (!diffPaths.has(thread.filePath)) {
      return true;
    }
    if (thread.startLine === 0 || thread.side === 'old') {
      return false;
    }
    return !uncommittedPaths || uncommittedPaths.has(thread.filePath);
  });
  if (elsewhere.length === 0) {
    return { here: threads, elsewhere };
  }
  const moved = new Set(elsewhere);
  return { here: threads.filter((thread) => !moved.has(thread)), elsewhere };
}
