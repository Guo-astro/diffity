import { describe, expect, it, vi } from 'vitest';

const heads: Record<string, string | null> = { work: 'head', 'head~1..head': 'head', 'old~1..old': 'old', 'main...feature': 'feature' };

vi.mock('../src/lib/tauri', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/tauri')>()),
  resolveRef: async (_repoPath: string, ref: string) => {
    if (!(ref in heads)) {
      throw new Error('invalid ref');
    }
    return { ref, label: ref, canRevert: false, baseSha: null, headSha: heads[ref] };
  },
}));

const { canEditRef } = await import('../src/features/claude/claude-runner');

describe('canEditRef', () => {
  it('allows the working tree and ranges ending at HEAD without asking git', async () => {
    expect(await canEditRef('/r', null)).toBe(true);
    expect(await canEditRef('/r', 'work')).toBe(true);
    expect(await canEditRef('/r', 'origin/main...HEAD')).toBe(true);
  });

  it('allows a commit only when it is the checked-out one', async () => {
    expect(await canEditRef('/r', 'head~1..head')).toBe(true);
    expect(await canEditRef('/r', 'old~1..old')).toBe(false);
    expect(await canEditRef('/r', 'main...feature')).toBe(false);
  });

  it('treats refs git cannot resolve as read-only', async () => {
    expect(await canEditRef('/r', 'gone~1..gone')).toBe(false);
  });
});
