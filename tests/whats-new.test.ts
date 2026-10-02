import { describe, expect, it } from 'vitest';
import { compareVersions, notesFrom, noteParts, releasesFrom, shouldShowUpdateNotice } from '../src/whats-new';

describe('shouldShowUpdateNotice', () => {
  it('says nothing on a fresh install', () => {
    expect(shouldShowUpdateNotice({ lastSeen: null, current: '0.0.3', returningUser: false })).toBe(false);
  });

  it('tells someone who used the app before the notice existed', () => {
    expect(shouldShowUpdateNotice({ lastSeen: null, current: '0.0.3', returningUser: true })).toBe(true);
  });

  it('shows after an update', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.0.2', current: '0.0.3', returningUser: true })).toBe(true);
  });

  it('does not show twice for the same version', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.0.3', current: '0.0.3', returningUser: true })).toBe(false);
  });

  it('does not show after a downgrade', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.1.0', current: '0.0.9', returningUser: true })).toBe(false);
  });

  it('compares numerically, not as text', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.0.9', current: '0.0.10', returningUser: true })).toBe(true);
  });
});

describe('compareVersions', () => {
  it('orders versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });
});

describe('releasesFrom', () => {
  it('keeps published releases, version without its v, in the order GitHub gives', () => {
    expect(
      releasesFrom([
        { tag_name: 'v0.0.9', body: '- Draft', published_at: null, draft: true },
        { tag_name: 'v0.0.8', body: '- Links in notes\n- Fixed a bug', published_at: '2026-10-02T11:00:00Z', draft: false, prerelease: false },
        { tag_name: 'v0.0.8-beta', published_at: '2026-10-01T00:00:00Z', prerelease: true },
        { tag_name: 'v0.0.7', body: null, published_at: '2026-10-01T17:01:45Z' },
      ]),
    ).toEqual([
      { version: '0.0.8', date: '2026-10-02T11:00:00Z', items: ['Links in notes', 'Fixed a bug'] },
      { version: '0.0.7', date: '2026-10-01T17:01:45Z', items: [] },
    ]);
  });

  it('reads anything that is not a list of releases as none', () => {
    expect(releasesFrom({ message: 'API rate limit exceeded' })).toEqual([]);
  });
});

describe('notesFrom', () => {
  it('takes one note a line, list marks off, blank lines out', () => {
    expect(notesFrom('- One\r\n\n* Two\nThree\n')).toEqual(['One', 'Two', 'Three']);
  });
});

describe('noteParts', () => {
  it('reads a Markdown link to the web as a link', () => {
    expect(noteParts('Read the [guide](https://diffity.com/guide) first')).toEqual([
      { kind: 'text', text: 'Read the ' },
      { kind: 'link', text: 'guide', href: 'https://diffity.com/guide' },
      { kind: 'text', text: ' first' },
    ]);
  });

  it('leaves a link to anything but the web as the text it was written as', () => {
    expect(noteParts('[mail](mailto:a@b.c)')).toEqual([{ kind: 'text', text: '[mail](mailto:a@b.c)' }]);
    expect(noteParts('[x](javascript:void)').every((part) => part.kind === 'text')).toBe(true);
  });

  it('marks code, and a shortcut as a key', () => {
    expect(noteParts('Press `⌘K` or add a `.diffityignore`')).toEqual([
      { kind: 'text', text: 'Press ' },
      { kind: 'key', text: '⌘K' },
      { kind: 'text', text: ' or add a ' },
      { kind: 'code', text: '.diffityignore' },
    ]);
  });
});
