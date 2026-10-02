import { useEffect } from 'react';
import { inView, isOpenThread, useRepoThreads } from '../../hooks/use-repo-threads';
import { useCurrentViewRef } from '../../hooks/use-current-view';
import { Skeleton } from '../../components/ui/skeleton';
import { toggleComments, useUi } from '../../lib/ui-store';
import { cn } from '../../lib/cn';
import { buttonOutline } from '../../components/ui/button-styles';
import { CommentIcon } from '../../components/ui/icon';
import { clearFreshComments, useCommentSync } from '../pr/pr-checkout';

export function CommentsButton() {
  const { data, isPending, isError } = useRepoThreads();
  const viewRef = useCurrentViewRef();
  const count = (data ?? []).filter((thread) => isOpenThread(thread) && inView(thread, viewRef)).length;
  const loading = isPending && !isError;
  const open = useUi((state) => state.commentsOpen);
  const fresh = useCommentSync((state) => state.fresh);

  useEffect(() => {
    if (open) {
      clearFreshComments();
    }
  }, [open, fresh]);

  return (
    <button
      onClick={toggleComments}
      className={cn(buttonOutline, 'relative px-2.5', open && 'bg-selected hover:bg-selected')}
      title={`${viewRef ? 'Comments in this view' : 'All comments in this repository'}${count > 0 ? ` (${count} open)` : ''}${fresh > 0 ? `; ${fresh} new from GitHub` : ''} — C`}
      aria-pressed={open}
    >
      <CommentIcon size="md" className="text-text-secondary" />
      {loading && <Skeleton className="w-2 h-3" />}
      {count > 0 && <span className="text-[13px] tabular-nums text-text">{count}</span>}
      {fresh > 0 && (
        <span
          aria-label={`${fresh} new from GitHub`}
          className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[10px] font-semibold leading-4 text-center tabular-nums ring-2 ring-frame"
        >
          +{fresh > 99 ? '99' : fresh}
        </span>
      )}
    </button>
  );
}
