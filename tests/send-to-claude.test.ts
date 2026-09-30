import { describe, expect, it } from 'vitest';
import { claudeReviewThreads, unaddressedThreads } from '../src/features/review/finish-review';
import type { CommentThread } from '../src/components/comments/types';

function thread(id: string, authors: ('user' | 'agent' | 'github')[], extra: Partial<CommentThread> = {}): CommentThread {
  return {
    id,
    filePath: 'src/a.ts',
    side: 'new',
    startLine: 1,
    endLine: 1,
    status: 'open',
    comments: authors.map((type, index) => ({
      id: `${id}-${index}`,
      author: { name: type, type },
      body: 'text',
      createdAt: '',
    })) as CommentThread['comments'],
    ...extra,
  };
}

describe('Send to Claude candidates', () => {
  const threads = [
    thread('mine', ['user']),
    thread('claude', ['agent']),
    thread('asked-back', ['user', 'agent']),
    thread('replied', ['agent', 'user']),
    thread('done', ['agent'], { status: 'resolved' }),
    thread('summary', ['agent'], { filePath: '__general__' }),
  ];

  it('offers Claude’s untouched review comments', () => {
    expect(claudeReviewThreads(threads).map((item) => item.id)).toEqual(['claude']);
  });

  it('keeps your comments, including replies to Claude, separate', () => {
    expect(unaddressedThreads(threads).map((item) => item.id)).toEqual(['mine', 'replied']);
  });
});
