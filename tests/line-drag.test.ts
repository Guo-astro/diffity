import { describe, expect, it } from 'vitest';
import { extendLineDrag, finishLineDrag, isLineInDrag, startLineDrag } from '../src/lib/line-drag';

describe('line drag', () => {
  it('selects the range between the anchor and the last line reached, in either direction', () => {
    let drag = extendLineDrag(startLineDrag('src/a.ts', 2, 'new'), 5, 'new');
    expect(finishLineDrag(drag, 'src/a.ts')).toEqual({ filePath: 'src/a.ts', side: 'new', startLine: 2, endLine: 5 });

    drag = extendLineDrag(startLineDrag('src/a.ts', 9, 'new'), 4, 'new');
    expect(finishLineDrag(drag, 'src/a.ts')).toEqual({ filePath: 'src/a.ts', side: 'new', startLine: 4, endLine: 9 });
  });

  it('turns a click without movement into a single-line selection', () => {
    expect(finishLineDrag(startLineDrag('src/a.ts', 7, 'old'), 'src/a.ts')).toEqual({
      filePath: 'src/a.ts',
      side: 'old',
      startLine: 7,
      endLine: 7,
    });
  });

  it('ignores lines on the other side of a split diff', () => {
    const drag = startLineDrag('src/a.ts', 3, 'new');
    expect(extendLineDrag(drag, 8, 'old')).toBe(drag);
    expect(isLineInDrag(drag, 'src/a.ts', 3, 'old')).toBe(false);
  });

  it('keeps selecting after the viewer switches files without remounting', () => {
    const first = extendLineDrag(startLineDrag('src/a.ts', 1, 'new'), 3, 'new');
    expect(finishLineDrag(first, 'src/a.ts')?.endLine).toBe(3);

    const second = extendLineDrag(startLineDrag('src/b.ts', 2, 'new'), 5, 'new');
    expect(finishLineDrag(second, 'src/b.ts')).toEqual({ filePath: 'src/b.ts', side: 'new', startLine: 2, endLine: 5 });
  });

  it('drops a drag that began in a file that is no longer shown', () => {
    const drag = extendLineDrag(startLineDrag('src/a.ts', 2, 'new'), 5, 'new');
    expect(finishLineDrag(drag, 'src/b.ts')).toBeNull();
    expect(isLineInDrag(drag, 'src/b.ts', 3, 'new')).toBe(false);
    expect(finishLineDrag(null, 'src/a.ts')).toBeNull();
  });
});
