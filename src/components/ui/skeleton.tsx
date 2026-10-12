import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  circle?: boolean;
}

/** Matches the delays of `.skeleton` in app.css. */
const SHOW_DELAY = 150;
const SHIMMER_DELAY = 270;
const SHIMMER_PERIOD = 1600;
/** A placeholder mounting this soon after a visible one unmounted takes over from it. */
const HANDOVER = 250;

interface Placement {
  visibleFrom: number;
  shimmerOrigin: number;
}

const live = new Set<Placement>();
let lastVisible: { at: number; shimmerOrigin: number } | null = null;

/** The shimmer origin of a placeholder already on screen, when there is one to continue from. */
function continuedOrigin(now: number): number | null {
  for (const placement of live) {
    if (now >= placement.visibleFrom) {
      return placement.shimmerOrigin;
    }
  }
  if (lastVisible && now - lastVisible.at < HANDOVER) {
    return lastVisible.shimmerOrigin;
  }
  return null;
}

function place(): Placement & { continued: CSSProperties | null } {
  const now = performance.now();
  const origin = continuedOrigin(now);
  if (origin === null) {
    return { visibleFrom: now + SHOW_DELAY, shimmerOrigin: now + SHIMMER_DELAY, continued: null };
  }
  const delay = -((now - origin) % SHIMMER_PERIOD);
  return { visibleFrom: now, shimmerOrigin: origin, continued: { ['--shimmer-delay' as string]: `${delay}ms` } };
}

/**
 * A fixed-size loading placeholder. It stays invisible for the first 150ms, so loads that finish quickly never
 * flash, then shows a quiet shimmer (static with reduced motion). Give it the size of what it stands in for.
 * One that replaces a placeholder already on screen shows at once and keeps its shimmer in step, so swapping
 * one loading view for the next doesn't blink.
 */
export function Skeleton(props: SkeletonProps) {
  const { className, style, circle } = props;
  const [placement] = useState(place);

  useLayoutEffect(() => {
    live.add(placement);
    return () => {
      live.delete(placement);
      const now = performance.now();
      if (now >= placement.visibleFrom) {
        lastVisible = { at: now, shimmerOrigin: placement.shimmerOrigin };
      }
    };
  }, [placement]);

  const { continued } = placement;

  return (
    <span
      data-skeleton
      aria-hidden
      className={cn('skeleton block shrink-0', continued && 'skeleton-instant', circle ? 'rounded-full' : 'rounded', className)}
      style={continued ? { ...continued, ...style } : style}
    />
  );
}

/**
 * Class for content that may replace a placeholder: it cross-fades in only when this component actually showed a
 * placeholder first. Content available at once (from the cache) renders without any animation.
 */
export function useRevealClass(loading: boolean): string {
  const waited = useRef(loading);
  if (loading) {
    waited.current = true;
  }
  return !loading && waited.current ? 'reveal' : '';
}

/** True once `ms` have passed since mount (a budget for slow, optional inputs such as GitHub lookups). */
export function useElapsed(ms: number): boolean {
  const [mountedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), Math.max(0, ms - (Date.now() - mountedAt)));
    return () => clearTimeout(timer);
  }, [ms, mountedAt]);
  return elapsed;
}

/** Stays true once `value` has been true: a decision that is made once and not taken back by a refetch. */
export function useLatch(value: boolean): boolean {
  const latched = useRef(value);
  if (value) {
    latched.current = true;
  }
  return latched.current;
}
