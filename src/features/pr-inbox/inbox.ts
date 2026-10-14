import type { InboxPullRequest, PrInbox } from '../../lib/types';

export type InboxGroup = 'review' | 'team' | 'assigned' | 'mine';

export const INBOX_GROUPS: { id: InboxGroup; label: string; short: string }[] = [
  { id: 'review', label: 'Needs your review', short: 'Review' },
  { id: 'team', label: 'Your team’s review', short: 'Team' },
  { id: 'assigned', label: 'Assigned to you', short: 'Assigned' },
  { id: 'mine', label: 'Your pull requests', short: 'Yours' },
];

export interface InboxItem {
  group: InboxGroup;
  pr: InboxPullRequest;
}

/** One list in group order; a PR only shows in the first group it matches, so team requests are what's left after yours. */
export function groupInbox(inbox: PrInbox): InboxItem[] {
  const seen = new Set<string>();
  const items: InboxItem[] = [];
  const add = (group: InboxGroup, prs: InboxPullRequest[]) => {
    for (const pr of prs) {
      if (seen.has(pr.url)) {
        continue;
      }
      seen.add(pr.url);
      items.push({ group, pr });
    }
  };
  add('review', inbox.reviewDirect);
  add('team', inbox.reviewRequested);
  add('assigned', inbox.assigned);
  add('mine', inbox.authored);
  return items;
}

export function filterInbox(items: InboxItem[], text: string, group: InboxGroup | 'all'): InboxItem[] {
  const words = text.trim().toLowerCase().replace(/^#/, '').split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (group !== 'all' && item.group !== group) {
      return false;
    }
    const haystack = `${item.pr.title} ${item.pr.repo} ${item.pr.repo}#${item.pr.number} ${item.pr.author}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function inboxCounts(items: InboxItem[]): Record<InboxGroup | 'all', number> {
  const counts = { all: items.length, review: 0, team: 0, assigned: 0, mine: 0 };
  for (const item of items) {
    counts[item.group] += 1;
  }
  return counts;
}

/** What a reviewer needs to know at a glance: whose move it is. */
export function reviewLabel(pr: InboxPullRequest): { label: string; tone: 'requested' | 'changes' | 'approved' | 'draft' } | null {
  if (pr.isDraft) {
    return { label: 'Draft', tone: 'draft' };
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return { label: 'Changes requested', tone: 'changes' };
  }
  if (pr.reviewDecision === 'APPROVED') {
    return { label: 'Approved', tone: 'approved' };
  }
  if (pr.reviewDecision === 'REVIEW_REQUIRED') {
    return { label: 'Review required', tone: 'requested' };
  }
  return null;
}

/** "5m", "3h", "2d", "4w", then the date. */
export function shortAgo(iso: string, now = Date.now()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    return '';
  }
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) {
    return 'now';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }
  if (days < 35) {
    return `${Math.round(days / 7)}w`;
  }
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
