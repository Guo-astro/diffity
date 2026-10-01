import type { CommentThread } from './types';
import { cn } from '../../lib/cn';
import { openComments } from '../../lib/ui-store';
import { CommentIcon } from '../ui/icon';

interface OutsideThreadsProps {
  threads: CommentThread[];
  viewEmpty?: boolean;
  className?: string;
}

/** Points to the Comments panel for threads whose code is no longer part of this view, e.g. after committing. */
export function OutsideThreads(props: OutsideThreadsProps) {
  const { threads, viewEmpty, className } = props;

  if (threads.length === 0) {
    return null;
  }

  const count = `${threads.length} comment${threads.length === 1 ? '' : 's'}`;
  const label = viewEmpty ? `${count} on code that's no longer in this view` : `${count} on files that are no longer changed in this view`;

  return (
    <div className={cn('flex items-center justify-center gap-2 text-xs text-text-muted', className)}>
      <CommentIcon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
      <span aria-hidden>·</span>
      <button onClick={openComments} className="text-text-secondary underline decoration-text-muted/50 underline-offset-2 hover:text-text cursor-pointer">
        Show in Comments
      </button>
    </div>
  );
}
