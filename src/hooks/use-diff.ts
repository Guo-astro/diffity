import { useSuspenseQuery } from '@tanstack/react-query';
import { diffOptions } from '../queries/diff';

export function useDiff(hideWhitespace = false, ref?: string, showIgnored = false) {
  const { data, error } = useSuspenseQuery(diffOptions(hideWhitespace, ref, showIgnored));

  return {
    data,
    error: error?.message ?? null,
  };
}
