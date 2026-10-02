import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Skeleton } from '../ui/skeleton';
import { SegmentedToggle } from '../ui/segmented-toggle';
import { buttonGhost } from '../ui/button-styles';
import { fetchCommit, fetchDiff, parseCommitRef } from '../../lib/api';
import { cn } from '../../lib/cn';
import { getFilePath } from '../../lib/diff-utils';
import { useCopy } from '../../hooks/use-copy';
import { useRepoNav } from '../../hooks/use-repo';
import { useGitHubPr, useGitStatus } from '../../hooks/use-repo-state';
import { AuthorAvatar } from './commit-list';
import { isAllChangesRef, isPrShapedRef, prDiffRef, rangeParts, shortBase, uncommittedTwin } from './ref-menu';
import { CheckIcon, CopyIcon, GitCompareIcon } from '../ui/icon';

export function useCommitDetails(sha: string | null) {
  return useQuery({
    queryKey: ['commit', sha],
    queryFn: () => fetchCommit(sha ?? ''),
    enabled: !!sha,
    staleTime: Infinity,
  });
}

function CommitHeader(props: { sha: string }) {
  const { sha } = props;
  const { copied, copy } = useCopy();
  const { data: commit, isLoading } = useCommitDetails(sha);

  if (isLoading) {
    return (
      <div aria-busy className="min-w-0">
        <div className="flex items-center h-6">
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="mt-0.5 flex items-center gap-2 h-5">
          <Skeleton circle className="w-5 h-5" />
          <Skeleton className="h-2.5 w-48" />
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <h2 className="text-[15px] font-semibold leading-6 text-text break-words">{commit?.message ?? `Commit ${sha.slice(0, 7)}`}</h2>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
        {commit && (
          <>
            <AuthorAvatar name={commit.author} email={commit.authorEmail} />
            <span>{commit.author}</span>
            <span className="text-text-muted">·</span>
            <span title={dayjs(commit.date).format('YYYY-MM-DD HH:mm')}>{commit.relativeDate}</span>
            <span className="text-text-muted">·</span>
          </>
        )}
        <button
          onClick={() => copy(sha)}
          className="inline-flex items-center gap-1 font-mono text-[11px] text-text-secondary hover:text-text cursor-pointer"
          title="Copy full commit hash"
        >
          {sha.slice(0, 7)}
          {copied ? <CheckIcon className="w-3 h-3 text-added" /> : <CopyIcon className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

const NO_PATHS = new Set<string>();

/** Paths with uncommitted changes: empty when the tree is clean, null while still unknown. */
export function useUncommittedPaths(): Set<string> | null {
  const { data: status } = useGitStatus();
  const dirty = !!status && status.staged + status.unstaged + status.untracked > 0;
  const signature = status ? `${status.staged}/${status.unstaged}/${status.untracked}` : '';
  const { data } = useQuery({
    queryKey: ['diff', 'uncommitted-files', signature],
    queryFn: () => fetchDiff(false, 'work', false),
    enabled: dirty,
    placeholderData: (previous) => previous,
  });
  const paths = useMemo(() => (data ? new Set(data.files.map(getFilePath)) : null), [data]);
  if (!status) {
    return null;
  }
  return dirty ? paths : NO_PATHS;
}

/** Files with uncommitted changes (a file both staged and edited counts once); 0 when the tree is clean. */
function useUncommittedFiles(): number {
  const { data: status } = useGitStatus();
  const paths = useUncommittedPaths();
  if (!status) {
    return 0;
  }
  return paths?.size ?? status.staged + status.unstaged + status.untracked;
}

/** The PR view shows commits only, since its comments must sit on lines GitHub has. */
function PrUncommittedNotice(props: { baseRef: string }) {
  const { baseRef } = props;
  const nav = useRepoNav();
  const files = useUncommittedFiles();

  if (files === 0) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-bg-secondary text-[13px] text-text-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-modified shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {plural(files, 'uncommitted file')} {files === 1 ? 'isn’t' : 'aren’t'} in this pull request yet
      </span>
      <button
        onClick={() => nav.toDiff(`origin/${baseRef}`)}
        className={cn(buttonGhost, 'h-6 px-2 text-xs text-text')}
        title="Everything on this branch plus your uncommitted changes. Comments there on uncommitted lines can’t be posted to GitHub until you push"
      >
        Show them
      </button>
    </div>
  );
}

/**
 * Switches a branch view between all changes (`main`) and commits only (`main...HEAD`) while the tree is dirty.
 * Both modes share one review, so comments and Viewed marks carry over. Lives in the title bar so it stays in sight.
 */
export function ChangesModeSwitch(props: { diffRef: string }) {
  const { diffRef } = props;
  const nav = useRepoNav();
  const files = useUncommittedFiles();
  const { details } = useGitHubPr();
  const twin = uncommittedTwin(diffRef);
  const including = isAllChangesRef(diffRef);

  if (!twin || files === 0 || (details && diffRef === prDiffRef(details))) {
    return null;
  }
  const count = plural(files, 'uncommitted file');
  return (
    <div className="flex items-center gap-2 shrink-0 text-xs text-text-secondary">
      <span className="hidden @[880px]/titlebar:inline-flex items-center gap-1.5" title={`${count} ${including ? 'included' : 'not shown'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-modified" aria-hidden />
        {files} uncommitted
      </span>
      <SegmentedToggle
        value={including ? 'all' : 'committed'}
        onChange={(value) => {
          if ((value === 'all') !== including) {
            nav.toDiff(twin);
          }
        }}
        labelClassName="text-xs"
        options={[
          { value: 'all', label: 'All changes', title: `Commits on this branch plus ${count}` },
          { value: 'committed', label: 'Committed only', title: 'Only what is committed, like the pull request will see it. Comments and Viewed marks are shared with All changes' },
        ]}
      />
    </div>
  );
}

/** A light header at the top of the diff for a commit or a compared range (not a sticky bar). */
export function DiffContextHeader(props: { diffRef: string }) {
  const { diffRef } = props;
  const { details, loading: prLoading } = useGitHubPr();
  const { data: status } = useGitStatus();
  const commitSha = parseCommitRef(diffRef);
  const isPr = details !== null && diffRef === prDiffRef(details);
  const mayBePr = prLoading && isPrShapedRef(diffRef);

  if (commitSha) {
    return <CommitHeader sha={commitSha} />;
  }
  if (isPr && details) {
    return <PrUncommittedNotice baseRef={details.baseRef} />;
  }
  if (mayBePr || (!diffRef.includes('..') && !isAllChangesRef(diffRef))) {
    return null;
  }
  const parts = isAllChangesRef(diffRef) ? { base: shortBase(diffRef), head: 'HEAD' } : rangeParts(diffRef);
  const base = parts.base;
  const head = parts.head === 'HEAD' ? status?.branch ?? 'HEAD' : parts.head;
  return (
    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0 min-h-7 text-xs text-text-secondary">
      <GitCompareIcon size="sm" className="text-text-muted" />
      <span className="truncate">
        {diffRef.includes('..') && !diffRef.includes('...')
          ? <>Every change after <code className="font-mono text-text">{base}</code>, up to <code className="font-mono text-text">{head}</code></>
          : <>Changes on <code className="font-mono text-text">{head}</code> since it split from <code className="font-mono text-text">{base}</code></>}
      </span>
    </div>
  );
}
