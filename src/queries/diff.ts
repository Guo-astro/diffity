import { queryOptions } from '@tanstack/react-query';
import type { DiffFile } from '@/lib/diff-parser';
import { fetchDiff, fetchFilePatch } from '../lib/api';
import { getFilePath } from '../lib/diff-utils';

export function diffOptions(hideWhitespace: boolean, ref?: string) {
  return queryOptions({
    queryKey: ['diff', hideWhitespace, ref ?? null],
    queryFn: () => fetchDiff(hideWhitespace, ref),
  });
}

/** The hunks of a file the backend sent without them (`patchOmitted`). */
export function filePatchOptions(file: DiffFile, hideWhitespace: boolean, ref?: string) {
  return queryOptions({
    queryKey: ['diff', 'file-patch', ref ?? 'work', hideWhitespace, getFilePath(file), file.additions, file.deletions],
    queryFn: () => fetchFilePatch(file, hideWhitespace, ref),
    staleTime: Infinity,
  });
}
