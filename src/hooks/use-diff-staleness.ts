import { useCallback, useEffect, useState } from 'react';
import { fetchDiffFingerprint } from '../lib/api';
import { useRepoChange } from './use-repo';

/**
 * Whether the files changed since the diff on screen was read. `baseline` is that diff's own fingerprint,
 * so a change can't slip in between reading the diff and taking a separate baseline.
 */
export function useDiffStaleness(baseline: string | undefined, ref?: string, showIgnored = false, enabled = true) {
  const [staleFor, setStaleFor] = useState<string | null>(null);
  const tick = useRepoChange((state) => state.tick);

  const resetStaleness = useCallback(() => setStaleFor(null), []);

  // Also re-runs when a new diff arrives, so a change that landed while it loaded is still caught.
  useEffect(() => {
    if (!enabled || !baseline || tick === 0) {
      return;
    }
    let cancelled = false;
    fetchDiffFingerprint(ref, showIgnored).then((fingerprint) => {
      if (!cancelled && fingerprint !== baseline) {
        setStaleFor(baseline);
      }
    }, () => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick, baseline, ref, showIgnored, enabled]);

  return { isStale: !!baseline && staleFor === baseline, resetStaleness };
}
