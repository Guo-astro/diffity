import { describe, expect, it } from 'vitest';
import { changeRequest, readsAsChangeRequest } from '../src/features/claude/ask-claude-review';

describe('readsAsChangeRequest', () => {
  it('spots instructions that ask for edits', () => {
    expect(readsAsChangeRequest('remove all the code comments from this file')).toBe(true);
    expect(readsAsChangeRequest('Please rename getUser to fetchUser')).toBe(true);
    expect(readsAsChangeRequest('can you fix the typo in the README')).toBe(true);
  });

  it('leaves review guidance alone', () => {
    expect(readsAsChangeRequest('Check error handling in the new API routes')).toBe(false);
    expect(readsAsChangeRequest('This is a perf refactor, look for regressions')).toBe(false);
    expect(readsAsChangeRequest('')).toBe(false);
  });
});

describe('changeRequest', () => {
  it('names the scope and the file on screen', () => {
    const text = changeRequest(' remove the comments in this file ', [], 'work', 'src/cache.ts');
    expect(text.startsWith('remove the comments in this file')).toBe(true);
    expect(text).toContain('files changed in `work`');
    expect(text).toContain('looking at `src/cache.ts`');
    expect(changeRequest('x', ['a.ts'], 'work', null)).toBe('x\n\nOnly change these files: `a.ts`.');
  });
});
