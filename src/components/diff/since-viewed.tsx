import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseDiff } from '@/lib/diff-parser';
import type { ViewMode } from '../../lib/diff-utils';
import { errorMessage, fetchViewedChanges } from '../../lib/api';
import { cn } from '../../lib/cn';
import { Spinner } from '../icons/spinner';
import { XIcon } from '../ui/icon';
import { HunkBlock } from './hunk-block';
import { HunkBlockSplit } from './hunk-block-split';

export interface SinceViewedInfo {
  sessionId: string;
  /** The viewed version was kept, so its changes can be shown. */
  canDiff: boolean;
  /** Changes whenever the file's diff does, to refetch the comparison. */
  version: string;
}

interface SinceViewedBadgeProps {
  canDiff: boolean;
  open: boolean;
  onToggle: () => void;
}

export function SinceViewedBadge(props: SinceViewedBadgeProps) {
  const { canDiff, open, onToggle } = props;

  if (!canDiff) {
    return (
      <span className="shrink-0 rounded-full bg-modified/12 px-1.5 text-[11px] font-medium leading-4 text-modified" title="This file changed after you marked it viewed">
        Changed since you viewed it
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'shrink-0 cursor-pointer rounded-full px-1.5 text-[11px] font-medium leading-4 text-modified transition-colors',
        open ? 'bg-modified/25' : 'bg-modified/12 hover:bg-modified/20',
      )}
      title={open ? 'Hide the changes since you viewed this file' : 'Show changes since viewed'}
      aria-expanded={open}
    >
      Changed since you viewed it
      <span className="ml-1 font-normal underline decoration-modified/50 underline-offset-2">{open ? 'Hide changes' : 'Show changes'}</span>
    </button>
  );
}

interface SinceViewedDiffProps {
  sessionId: string;
  filePath: string;
  version: string;
  viewMode: ViewMode;
  onClose: () => void;
}

/** What changed in a file between the version marked viewed and now, shown above its regular diff. */
export function SinceViewedDiff(props: SinceViewedDiffProps) {
  const { sessionId, filePath, version, viewMode, onClose } = props;
  const query = useQuery({
    queryKey: ['viewed-changes', sessionId, filePath, version],
    queryFn: () => fetchViewedChanges(sessionId, filePath),
    staleTime: Infinity,
  });
  const file = useMemo(() => (query.data ? parseDiff(query.data).files[0] ?? null : null), [query.data]);

  const renderBody = () => {
    if (query.isPending) {
      return (
        <div className="flex h-12 items-center justify-center gap-2 text-[13px] text-text-muted">
          <Spinner className="h-3.5 w-3.5" />
          Loading changes…
        </div>
      );
    }
    if (query.isError) {
      return <div className="p-4 text-center text-[13px] text-text-muted">{errorMessage(query.error)}</div>;
    }
    if (!file || file.hunks.length === 0) {
      return <div className="p-4 text-center text-[13px] text-text-muted italic">The file's contents are the same as when you viewed it</div>;
    }
    return (
      <table className="w-full border-collapse table-fixed">
        {viewMode === 'split' ? (
          <colgroup>
            <col className="w-12" />
            <col className="w-[calc(50%-48px)]" />
            <col className="w-12" />
            <col />
          </colgroup>
        ) : (
          <colgroup>
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-5" />
            <col />
          </colgroup>
        )}
        {file.hunks.map((hunk, index) => (viewMode === 'split'
          ? <HunkBlockSplit key={index} hunk={hunk} filePath={filePath} />
          : <HunkBlock key={index} hunk={hunk} filePath={filePath} />))}
      </table>
    );
  };

  return (
    <div className="border-b-4 border-modified/25">
      <div className="flex h-8 items-center gap-2 border-b border-border-muted bg-modified/8 pl-3 pr-2 text-xs text-text-secondary">
        <span className="font-medium text-modified">Changes since you viewed it</span>
        {file && <span className="tabular-nums"><span className="text-diff-added">+{file.additions}</span> <span className="text-diff-deleted">-{file.deletions}</span></span>}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="grid h-5 w-5 cursor-pointer place-items-center rounded text-text-muted hover:bg-hover hover:text-text"
          aria-label="Hide changes since viewed"
          title="Hide changes since viewed"
        >
          <XIcon size={10} />
        </button>
      </div>
      {renderBody()}
    </div>
  );
}
