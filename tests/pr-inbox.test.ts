import { describe, expect, it } from 'vitest';
import { filterInbox, groupInbox, inboxCounts, reviewLabel, shortAgo } from '../src/features/pr-inbox/inbox';
import type { InboxPullRequest } from '../src/lib/types';

function pr(repo: string, number: number, extra: Partial<InboxPullRequest> = {}): InboxPullRequest {
  return {
    number,
    title: `PR ${number}`,
    url: `https://github.com/${repo}/pull/${number}`,
    state: 'OPEN',
    isDraft: false,
    author: 'alice',
    baseRef: 'main',
    headRef: 'feat',
    headSha: 'abc',
    reviewDecision: null,
    checks: null,
    body: '',
    createdAt: '',
    reviewThreadCount: 0,
    updatedAt: '',
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    headRepo: repo,
    isCrossRepository: false,
    repo,
    commentCount: 0,
    checkCount: 0,
    ...extra,
  };
}

describe('groupInbox', () => {
  it('lists each PR once, in the first group it matches', () => {
    const direct = pr('o/a', 1);
    const team = pr('o/b', 2);
    const items = groupInbox({ reviewDirect: [direct], reviewRequested: [direct, team], assigned: [team, pr('o/c', 3)], authored: [pr('me/x', 4)] });
    expect(items.map((item) => [item.group, item.pr.number])).toEqual([['review', 1], ['team', 2], ['assigned', 3], ['mine', 4]]);
    expect(inboxCounts(items)).toEqual({ all: 4, review: 1, team: 1, assigned: 1, mine: 1 });
  });
});

describe('filterInbox', () => {
  const items = groupInbox({
    reviewDirect: [pr('acme/api', 12, { title: 'Retry webhooks', author: 'jdoe' })],
    reviewRequested: [],
    assigned: [],
    authored: [pr('acme/web', 7, { title: 'Upgrade React' })],
  });

  it('matches title, repo, number and author words', () => {
    expect(filterInbox(items, 'webhook', 'all').map((item) => item.pr.number)).toEqual([12]);
    expect(filterInbox(items, 'acme/web', 'all').map((item) => item.pr.number)).toEqual([7]);
    expect(filterInbox(items, '#12', 'all').map((item) => item.pr.number)).toEqual([12]);
    expect(filterInbox(items, 'api#12', 'all').map((item) => item.pr.number)).toEqual([12]);
    expect(filterInbox(items, 'jdoe retry', 'all').map((item) => item.pr.number)).toEqual([12]);
  });

  it('limits to a group', () => {
    expect(filterInbox(items, '', 'mine').map((item) => item.pr.number)).toEqual([7]);
    expect(filterInbox(items, 'webhook', 'mine')).toEqual([]);
  });
});

describe('reviewLabel', () => {
  it('puts drafts first, then the review decision', () => {
    expect(reviewLabel(pr('o/a', 1, { isDraft: true, reviewDecision: 'APPROVED' }))?.label).toBe('Draft');
    expect(reviewLabel(pr('o/a', 1, { reviewDecision: 'CHANGES_REQUESTED' }))?.tone).toBe('changes');
    expect(reviewLabel(pr('o/a', 1, { reviewDecision: 'APPROVED' }))?.tone).toBe('approved');
    expect(reviewLabel(pr('o/a', 1))).toBeNull();
  });
});

describe('shortAgo', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  it('shortens recent times', () => {
    expect(shortAgo('2026-10-14T11:59:40Z', now)).toBe('now');
    expect(shortAgo('2026-10-14T11:55:00Z', now)).toBe('5m');
    expect(shortAgo('2026-10-14T09:00:00Z', now)).toBe('3h');
    expect(shortAgo('2026-10-12T12:00:00Z', now)).toBe('2d');
    expect(shortAgo('2026-09-30T12:00:00Z', now)).toBe('2w');
    expect(shortAgo('', now)).toBe('');
  });
});
