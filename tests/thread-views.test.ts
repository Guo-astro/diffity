import { describe, expect, it } from 'vitest';
import type { CommentThread } from '../src/components/comments/types';
import { GENERAL_THREAD_FILE_PATH } from '../src/components/comments/types';
import { splitThreadsByView } from '../src/lib/thread-views';

function thread(id: string, overrides: Partial<CommentThread>): CommentThread {
  return { id, filePath: 'src/a.ts', side: 'new', startLine: 3, endLine: 3, comments: [], status: 'open', ...overrides };
}

describe('splitThreadsByView', () => {
  const diffPaths = new Set(['src/a.ts', 'src/b.ts']);

  it('keeps threads of this view and lines both modes number alike', () => {
    const threads = [
      thread('same', { viewRef: 'main...HEAD' }),
      thread('legacy', { viewRef: null }),
      thread('clean', { viewRef: 'main', filePath: 'src/b.ts' }),
      thread('old-side', { viewRef: 'main', side: 'old' }),
      thread('whole-file', { viewRef: 'main', startLine: 0, endLine: 0 }),
      thread('general', { viewRef: 'main', filePath: GENERAL_THREAD_FILE_PATH }),
    ];
    const { here, elsewhere } = splitThreadsByView(threads, 'main...HEAD', diffPaths, new Set(['src/a.ts']));
    expect(here).toBe(threads);
    expect(elsewhere).toEqual([]);
  });

  it('moves threads from the other mode on uncommitted lines or files', () => {
    const threads = [
      thread('dirty', { viewRef: 'main' }),
      thread('untracked', { viewRef: 'main', filePath: 'src/new.ts' }),
      thread('mine', { viewRef: 'main...HEAD' }),
    ];
    const { here, elsewhere } = splitThreadsByView(threads, 'main...HEAD', diffPaths, new Set(['src/a.ts', 'src/new.ts']));
    expect(here.map((t) => t.id)).toEqual(['mine']);
    expect(elsewhere.map((t) => t.id)).toEqual(['dirty', 'untracked']);
  });

  it('holds back new-side threads from the other mode while uncommitted files are unknown', () => {
    const { elsewhere } = splitThreadsByView([thread('t', { viewRef: 'main' })], 'main...HEAD', diffPaths, null);
    expect(elsewhere).toHaveLength(1);
  });
});
