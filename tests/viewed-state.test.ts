import { describe, expect, it } from 'vitest';
import { parseDiff } from '../src/lib/diff-parser';
import { computeViewedState, fileHash } from '../src/lib/viewed-state';

const patch = (line: string) => `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1 @@
-old
+${line}
`;

describe('computeViewedState', () => {
  const hashes = new Map([['a.ts', 'h2'], ['b.ts', 'h3'], ['c.ts', 'h4']]);

  it('keeps files whose diff is unchanged viewed', () => {
    const state = computeViewedState([{ filePath: 'b.ts', contentHash: 'h3', blobId: 'x' }], hashes);
    expect([...state.reviewed]).toEqual(['b.ts']);
    expect(state.changed.size).toBe(0);
  });

  it('flags files that changed after being viewed, unticked', () => {
    const state = computeViewedState([
      { filePath: 'a.ts', contentHash: 'h1', blobId: 'abc' },
      { filePath: 'c.ts', contentHash: 'old', blobId: null },
      { filePath: 'd.ts', contentHash: 'h9', blobId: 'def' },
    ], hashes);
    expect(state.reviewed.size).toBe(0);
    expect(state.changed.get('a.ts')).toEqual({ canDiff: true });
    expect(state.changed.get('c.ts')).toEqual({ canDiff: false });
    expect(state.changed.has('d.ts')).toBe(false);
  });

  it('clears the flag once the file is marked viewed again', () => {
    const state = computeViewedState([{ filePath: 'a.ts', contentHash: 'h2', blobId: 'new' }], hashes);
    expect(state.reviewed.has('a.ts')).toBe(true);
    expect(state.changed.has('a.ts')).toBe(false);
  });
});

describe('fileHash', () => {
  it('changes with the file diff', () => {
    const one = parseDiff(patch('new')).files[0];
    const same = parseDiff(patch('new')).files[0];
    const other = parseDiff(patch('newer')).files[0];
    expect(fileHash(one)).toBe(fileHash(same));
    expect(fileHash(one)).not.toBe(fileHash(other));
  });
});
