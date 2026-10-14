import { describe, it, expect } from 'vitest';
import { labelFor, parsePrInput, prRefFor } from '../src/features/pr/pr-checkout';
import { guessBaseBranch } from '../src/hooks/use-repo-state';

describe('parsePrInput', () => {
  it('accepts numbers and PR urls', () => {
    expect(parsePrInput('12')).toBe('12');
    expect(parsePrInput(' #12 ')).toBe('12');
    expect(parsePrInput('https://github.com/o/r/pull/7/files')).toBe('https://github.com/o/r/pull/7/files');
  });

  it('rejects search text', () => {
    expect(parsePrInput('fix cache')).toBeNull();
    expect(parsePrInput('12a')).toBeNull();
    expect(parsePrInput('https://github.com/o/r/issues/7')).toBeNull();
  });
});

describe('labels and refs', () => {
  it('labels inputs by number', () => {
    expect(labelFor('12')).toBe('#12');
    expect(labelFor('https://github.com/o/r/pull/7')).toBe('#7');
  });

  it('diffs the PR against its base like GitHub', () => {
    expect(prRefFor({ baseRef: 'main' })).toBe('origin/main...HEAD');
    expect(prRefFor({ baseRef: 'main', baseRemote: 'upstream' })).toBe('upstream/main...HEAD');
  });
});

describe('guessBaseBranch', () => {
  const branch = (name: string, isRemote = name.includes('/')) => ({ name, isRemote, isCurrent: false, upstream: null, ahead: 0, behind: 0 });

  it('prefers upstream in a fork, then origin, then a local branch', () => {
    expect(guessBaseBranch([branch('main'), branch('origin/main'), branch('upstream/main')], 'feat')).toBe('upstream/main');
    expect(guessBaseBranch([branch('main'), branch('origin/main')], 'feat')).toBe('origin/main');
    expect(guessBaseBranch([branch('main')], 'feat')).toBe('main');
  });

  it('skips the current branch and its remote copies', () => {
    expect(guessBaseBranch([branch('main'), branch('upstream/main'), branch('master')], 'main')).toBe('master');
  });
});
