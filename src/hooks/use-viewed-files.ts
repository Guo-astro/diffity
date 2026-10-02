import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ParsedDiff } from '@/lib/diff-parser';
import { toast } from 'sonner';
import * as tauri from '../lib/tauri';
import type { ViewedFile } from '../lib/types';
import { getFilePath } from '../lib/diff-utils';
import { computeViewedState, fileHash } from '../lib/viewed-state';

export function useViewedFiles(sessionId: string | null, diff: ParsedDiff | undefined, viewRef: string) {
  const queryClient = useQueryClient();
  const queryKey = ['viewed', sessionId];
  const { data: viewed, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => tauri.listViewed(sessionId ?? ''),
    enabled: sessionId !== null,
  });

  const hashes = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of diff?.files ?? []) {
      map.set(getFilePath(file), fileHash(file));
    }
    return map;
  }, [diff]);

  const { reviewed: reviewedFiles, changed: changedFiles } = useMemo(() => computeViewedState(viewed ?? [], hashes), [viewed, hashes]);

  const setReviewed = useCallback((path: string, reviewed: boolean) => {
    if (!sessionId) {
      return;
    }
    const contentHash = hashes.get(path) ?? '';
    queryClient.setQueryData<ViewedFile[]>(['viewed', sessionId], (prev) => {
      const rest = (prev ?? []).filter((entry) => entry.filePath !== path);
      return reviewed ? [...rest, { filePath: path, contentHash, blobId: null }] : rest;
    });
    tauri.setViewed(sessionId, path, contentHash, reviewed, viewRef).then(
      () => {
        if (reviewed) {
          queryClient.invalidateQueries({ queryKey: ['viewed', sessionId] });
        }
      },
      (error) => {
        toast.error(tauri.errorMessage(error));
        queryClient.invalidateQueries({ queryKey: ['viewed', sessionId] });
      },
    );
  }, [sessionId, hashes, queryClient, viewRef]);

  return { reviewedFiles, changedFiles, hashes, setReviewed, loading: sessionId !== null && isPending && !isError };
}
