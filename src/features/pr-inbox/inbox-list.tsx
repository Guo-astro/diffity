import { cn } from '../../lib/cn';
import { openSettingsAt } from '../../lib/ui-store';
import { buttonOutline } from '../../components/ui/button-styles';
import { RefreshIcon } from '../../components/ui/icon';
import { Spinner } from '../../components/icons/spinner';
import { INBOX_GROUPS, shortAgo, type InboxGroup, type InboxItem } from './inbox';
import { InboxRow } from './inbox-row';
import type { usePrInbox } from './use-pr-inbox';

interface OpenTabsProps {
  mode: 'projects' | 'prs';
  group: InboxGroup | 'all';
  counts: Record<InboxGroup | 'all', number>;
  signedIn: boolean;
  onProjects: () => void;
  onGroup: (group: InboxGroup | 'all') => void;
  updatedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}

function updatedLabel(updatedAt: number): string {
  const ago = shortAgo(new Date(updatedAt).toISOString());
  return ago === 'now' ? 'Updated just now' : `Updated ${ago} ago`;
}

function Tab(props: { selected: boolean; onClick: () => void; label: string; count?: number; hot?: boolean }) {
  const { selected, onClick, label, count, hot = false } = props;

  return (
    <button
      tabIndex={-1}
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 -mb-px px-0.5 border-b-2 text-[13px] whitespace-nowrap cursor-pointer transition-colors',
        selected ? 'border-text text-text font-medium' : 'border-transparent text-text-secondary hover:text-text',
        count === 0 && !selected && 'text-text-muted',
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn('min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] text-center tabular-nums', hot ? 'bg-accent text-white font-semibold' : 'bg-fill text-text-secondary')}>
          {count}
        </span>
      )}
    </button>
  );
}

/** Projects and the pull request groups in one row; picking a group switches to pull requests. */
export function OpenTabs(props: OpenTabsProps) {
  const { mode, group, counts, signedIn, onProjects, onGroup, updatedAt, refreshing, onRefresh } = props;
  const prs = mode === 'prs';

  return (
    <div role="tablist" className="flex items-center gap-4 px-4 border-b border-overlay-border overflow-x-auto">
      <Tab selected={!prs} onClick={onProjects} label="Projects" />
      <span aria-hidden className="h-4 border-l border-overlay-border" />
      {signedIn ? (
        <>
          {INBOX_GROUPS.map((item) => (
            <Tab key={item.id} selected={prs && group === item.id} onClick={() => onGroup(item.id)} label={item.short} count={counts[item.id]} hot={item.id === 'review'} />
          ))}
          <Tab selected={prs && group === 'all'} onClick={() => onGroup('all')} label="All pull requests" count={counts.all} />
        </>
      ) : (
        <Tab selected={prs} onClick={() => onGroup('all')} label="Pull requests" />
      )}
      <span className="flex-1" />
      {prs && signedIn && (
        <button
          tabIndex={-1}
          onClick={onRefresh}
          disabled={refreshing}
          title={updatedAt > 0 ? `${updatedLabel(updatedAt)} · Refresh` : 'Refresh'}
          className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-md text-text-muted hover:text-text hover:bg-hover cursor-pointer disabled:cursor-default"
        >
          {refreshing ? <Spinner className="w-3 h-3" /> : <RefreshIcon className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

function Message(props: { title: string; detail?: string; action?: { label: string; run: () => void } }) {
  const { title, detail, action } = props;

  return (
    <div className="px-6 py-8 text-center">
      <div className="text-[13px] font-medium text-text">{title}</div>
      {detail && <div className="mt-1 text-xs text-text-secondary">{detail}</div>}
      {action && (
        <button onClick={action.run} className={cn(buttonOutline, 'mt-3')}>
          {action.label}
        </button>
      )}
    </div>
  );
}

interface InboxListProps {
  inbox: ReturnType<typeof usePrInbox>;
  items: InboxItem[];
  grouped: boolean;
  filtering: boolean;
  active: number;
  clones: Map<string, string>;
  onHover: (index: number) => void;
  onOpen: (item: InboxItem, newWindow: boolean) => void;
}

export function InboxList(props: InboxListProps) {
  const { inbox, items, grouped, filtering, active, clones, onHover, onOpen } = props;

  if (!inbox.authKnown) {
    return null;
  }
  if (!inbox.signedIn) {
    return (
      <Message
        title="Connect GitHub to see your pull requests"
        detail="Diffity can use your GitHub CLI login, or you can sign in."
        action={{ label: 'Connect GitHub', run: () => openSettingsAt('github') }}
      />
    );
  }
  if (inbox.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-secondary">
        <Spinner className="w-3.5 h-3.5" />
        Loading pull requests
      </div>
    );
  }
  if (inbox.error && inbox.items.length === 0) {
    return <Message title="Couldn’t load pull requests" detail={inbox.error} action={{ label: 'Try again', run: inbox.refresh }} />;
  }
  if (inbox.items.length === 0) {
    return <Message title="Nothing waiting on you" detail="No open pull requests ask for your review, are assigned to you, or are yours." />;
  }
  if (items.length === 0) {
    return <Message title={filtering ? 'No matches' : 'Nothing here'} detail={filtering ? 'Try another word, or paste a PR URL to open it.' : undefined} />;
  }
  return (
    <>
      {items.map((item, index) => {
        const header = grouped && item.group !== items[index - 1]?.group ? INBOX_GROUPS.find((entry) => entry.id === item.group)?.label : null;
        return (
          <div key={item.pr.url}>
            {header && <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-text-muted">{header}</div>}
            <InboxRow
              item={item}
              localPath={clones.get(item.pr.repo.toLowerCase())}
              active={index === active}
              onHover={() => onHover(index)}
              onOpen={(newWindow) => onOpen(item, newWindow)}
            />
          </div>
        );
      })}
    </>
  );
}
