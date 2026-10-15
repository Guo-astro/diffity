import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useRepoNav } from '../../hooks/use-repo';
import { useBranches, useGitHubAuth, useGitHubPr, useHasGitHubRemote, useWorktrees } from '../../hooks/use-repo-state';
import { openRepoAt, shortPath } from '../welcome/recent-repos';
import { cn } from '../../lib/cn';
import { openSettingsAt } from '../../lib/ui-store';
import type { Branch, PullRequest } from '../../lib/types';
import { PopoverSearch } from '../../components/ui/popover-search';
import { Spinner } from '../../components/icons/spinner';
import { ChecksStatus, PrStateIcon } from './pr-meta';
import { checkoutPullRequest, labelFor, localNameFor, parsePrInput, switchBranch, useCheckoutState } from './pr-checkout';
import { usePullRequests } from './pull-requests-dialog';
import { CheckIcon, ChevronUpDownIcon, GitBranchIcon, GitPullRequestIcon } from '../../components/ui/icon';
import { Popover } from '../../components/ui/popover';

const sectionClass = 'px-2.5 pt-2.5 pb-1 text-[11px] font-medium text-text-secondary';

function Row(props: { icon: ReactNode; title: ReactNode; meta?: ReactNode; selected?: boolean; tooltip?: string; onClick: () => void }) {
  const { icon, title, meta, selected, tooltip, onClick } = props;

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={cn(
        'flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md text-left transition-colors cursor-pointer',
        selected ? 'bg-selected' : 'hover:bg-hover',
      )}
    >
      <span className={cn('flex items-center shrink-0', selected ? 'text-text' : 'text-text-secondary')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{title}</span>
      {meta && <span className="shrink-0 flex items-center gap-2 text-xs text-text-secondary">{meta}</span>}
      <span className="w-3.5 shrink-0 flex items-center">{selected && <CheckIcon className="w-3.5 h-3.5 text-text-secondary" />}</span>
    </button>
  );
}

function matchesText(value: string, needle: string) {
  return !needle || value.toLowerCase().includes(needle.toLowerCase());
}

function prMatches(pr: PullRequest, needle: string) {
  return matchesText(`${pr.number} #${pr.number} ${pr.title} ${pr.author} ${pr.headRef}`, needle);
}

function BranchSwitcherPanel(props: { current: string | null; onDone: () => void }) {
  const { current, onDone } = props;
  const nav = useRepoNav();
  const navigate = useNavigate();
  const { data: branches, isLoading } = useBranches();
  const { data: worktrees } = useWorktrees();
  const hasGitHubRemote = useHasGitHubRemote();
  const { data: auth } = useGitHubAuth();
  const { details } = useGitHubPr();
  const prsEnabled = hasGitHubRemote && !!auth?.authenticated;
  const prs = usePullRequests(prsEnabled);
  const [search, setSearch] = useState('');
  const needle = search.trim();

  const { local, remote } = useMemo(() => {
    const all = branches ?? [];
    const localNames = new Set(all.filter((branch) => !branch.isRemote).map((branch) => branch.name));
    return {
      local: all.filter((branch) => !branch.isRemote && matchesText(branch.name, needle)),
      remote: all.filter((branch) => branch.isRemote && !localNames.has(localNameFor(branch.name, true)) && matchesText(branch.name, needle)),
    };
  }, [branches, needle]);

  const elsewhere = useMemo(() => {
    const map = new Map<string, string>();
    for (const tree of worktrees ?? []) {
      if (tree.branch && !tree.isCurrent) {
        map.set(tree.branch, tree.path);
      }
    }
    return map;
  }, [worktrees]);

  const pullRequests = (prs.data ?? []).filter((pr) => prMatches(pr, needle));
  const prInput = parsePrInput(needle);

  const pickBranch = (branch: Branch) => {
    onDone();
    void switchBranch(nav.repoPath, localNameFor(branch.name, branch.isRemote), nav.toDiff);
  };

  const pickPr = (input: string) => {
    onDone();
    void checkoutPullRequest(nav.repoPath, input, nav);
  };

  return (
    <div className="max-h-[min(460px,70vh)] flex flex-col font-sans overflow-hidden text-text">
      <PopoverSearch
        value={search}
        onChange={setSearch}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && prInput && prsEnabled) {
            pickPr(prInput);
          }
        }}
        placeholder={prsEnabled ? 'Branch, #PR or PR URL' : 'Switch branch'}
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-1">
        {prInput && prsEnabled && (
          <Row
            icon={<GitPullRequestIcon className="w-3.5 h-3.5" />}
            title={`Check out pull request ${labelFor(prInput)}`}
            onClick={() => pickPr(prInput)}
          />
        )}

        <div className={sectionClass}>Local branches</div>
        {isLoading && (
          <div className="flex items-center gap-2 h-8 px-2.5 text-xs text-text-secondary">
            <Spinner className="w-3 h-3" />
            Loading branches…
          </div>
        )}
        {!isLoading && local.length === 0 && <div className="h-8 px-2.5 flex items-center text-xs text-text-secondary">No matching branches</div>}
        {local.map((branch) => {
          const worktree = elsewhere.get(branch.name);
          return (
            <Row
              key={branch.name}
              icon={<GitBranchIcon className="w-3.5 h-3.5" />}
              title={<span className="font-mono text-xs">{branch.name}</span>}
              selected={branch.name === current}
              tooltip={worktree ? `Checked out in ${shortPath(worktree)} — opens that worktree` : undefined}
              meta={
                <>
                  {(branch.ahead > 0 || branch.behind > 0) && (
                    <span className="tabular-nums">
                      {branch.ahead > 0 && `↑${branch.ahead}`} {branch.behind > 0 && `↓${branch.behind}`}
                    </span>
                  )}
                  {worktree && <span className="px-1.5 rounded bg-fill text-[11px] text-text-secondary">worktree</span>}
                </>
              }
              onClick={() => {
                if (branch.name === current) {
                  onDone();
                  return;
                }
                if (worktree) {
                  onDone();
                  void openRepoAt(worktree, navigate);
                  return;
                }
                pickBranch(branch);
              }}
            />
          );
        })}

        {remote.length > 0 && <div className={sectionClass}>Remote branches</div>}
        {remote.slice(0, needle ? 50 : 12).map((branch) => (
          <Row
            key={branch.name}
            icon={<GitBranchIcon className="w-3.5 h-3.5" />}
            title={<span className="font-mono text-xs">{branch.name}</span>}
            tooltip={`Check out ${localNameFor(branch.name, true)} tracking ${branch.name}`}
            onClick={() => pickBranch(branch)}
          />
        ))}

        {hasGitHubRemote && <div className={sectionClass}>Pull requests</div>}
        {hasGitHubRemote && !auth?.authenticated && (
          <button
            onClick={() => {
              onDone();
              openSettingsAt('github');
            }}
            className="flex items-center h-8 px-2.5 w-full rounded-md text-xs text-text hover:bg-hover cursor-pointer"
          >
            Sign in to GitHub to see open pull requests
          </button>
        )}
        {prsEnabled && prs.isLoading && (
          <div className="flex items-center gap-2 h-8 px-2.5 text-xs text-text-secondary">
            <Spinner className="w-3 h-3" />
            Loading pull requests…
          </div>
        )}
        {prsEnabled && prs.isError && <div className="h-8 px-2.5 flex items-center text-xs text-deleted">Could not load pull requests</div>}
        {prsEnabled && prs.data && pullRequests.length === 0 && (
          <div className="h-8 px-2.5 flex items-center text-xs text-text-secondary">{needle ? 'No matching pull requests' : 'No open pull requests'}</div>
        )}
        {pullRequests.map((pr) => (
          <Row
            key={pr.number}
            icon={<PrStateIcon pr={pr} className="w-3.5 h-3.5" />}
            title={
              <>
                <span className="text-text-secondary tabular-nums">#{pr.number}</span> {pr.title}
              </>
            }
            tooltip={`${pr.title}\n${pr.author} · ${pr.headRef} → ${pr.baseRef}`}
            selected={details?.prNumber === pr.number}
            meta={<ChecksStatus checks={pr.checks} />}
            onClick={() => pickPr(String(pr.number))}
          />
        ))}
      </div>
    </div>
  );
}

export function BranchSwitcher(props: { branch: string | null; className?: string }) {
  const { branch, className } = props;
  const [open, setOpen] = useState(false);
  const busy = useCheckoutState((state) => state.busy);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(className, 'hover:bg-hover hover:text-text cursor-pointer', open && 'bg-hover text-text')}
        title={branch ? `On branch ${branch} — switch branch or check out a pull request` : 'Switch branch'}
      >
        {busy ? <Spinner className="w-3 h-3 shrink-0" /> : <GitBranchIcon className="w-3 h-3 shrink-0" />}
        <span className="truncate max-w-[220px] font-mono">{branch ?? 'detached'}</span>
        <span className="text-text-muted shrink-0 flex"><ChevronUpDownIcon /></span>
      </button>
      <Popover open={open} onClose={close} anchorRef={ref} width={320} className="p-0 overflow-hidden flex flex-col">
        <BranchSwitcherPanel current={branch} onDone={close} />
      </Popover>
    </div>
  );
}
