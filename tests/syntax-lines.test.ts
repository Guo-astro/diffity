import { beforeAll, describe, expect, it } from 'vitest';
import { createHighlighter, type Highlighter } from 'shiki';
import type { DiffHunk, DiffLine } from '@/lib/diff-parser';
import {
  buildSyntaxMap,
  hunkSources,
  planSyntaxSources,
  sideMatchesFile,
  tokenizeSources,
  type ChunkTokenizer,
  type SideTokens,
} from '../src/lib/syntax-lines';

let highlighter: Highlighter;

beforeAll(async () => {
  highlighter = await createHighlighter({ themes: ['github-light'], langs: ['typescript', 'java'] });
});

function tokenizer(lang: 'typescript' | 'java'): ChunkTokenizer {
  return (code, state) => {
    const result = highlighter.codeToTokens(code, { lang, theme: 'github-light', grammarState: state });
    return {
      lines: result.tokens.map((line) => line.map((token) => ({ text: token.content, color: token.color }))),
      state: result.grammarState,
    };
  };
}

function line(type: DiffLine['type'], content: string, oldLineNumber: number | null, newLineNumber: number | null): DiffLine {
  return { type, content, oldLineNumber, newLineNumber };
}

function hunk(lines: DiffLine[]): DiffHunk {
  const oldLines = lines.filter((l) => l.type !== 'add');
  const newLines = lines.filter((l) => l.type !== 'delete');
  return {
    header: '',
    oldStart: oldLines[0]?.oldLineNumber ?? 0,
    oldCount: oldLines.length,
    newStart: newLines[0]?.newLineNumber ?? 0,
    newCount: newLines.length,
    lines,
  };
}

function run(sources: ReturnType<typeof hunkSources>, tokenize: ChunkTokenizer, chunkLines?: number): SideTokens {
  const tokens: SideTokens = { old: new Map(), new: new Map() };
  const work = tokenizeSources(sources, tokenize, tokens, chunkLines);
  while (!work.next().done) {
    continue;
  }
  return tokens;
}

const COMMENT_GREEN = '#6A737D';

function colorOf(tokens: { text: string; color?: string }[] | undefined, text: string): string | undefined {
  return tokens?.find((token) => token.text.includes(text))?.color?.toUpperCase();
}

describe('hunkSources', () => {
  it('splits each hunk into its old (context + deleted) and new (context + added) sides, in order', () => {
    const hunks = [hunk([
      line('context', 'a', 1, 1),
      line('delete', 'b', 2, null),
      line('add', 'B', null, 2),
      line('context', 'c', 3, 3),
    ])];

    expect(hunkSources(hunks)).toEqual([
      { side: 'old', numbers: [1, 2, 3], lines: ['a', 'b', 'c'] },
      { side: 'new', numbers: [1, 2, 3], lines: ['a', 'B', 'c'] },
    ]);
  });
});

describe('multi-line highlighting', () => {
  it('colours every line of a /** */ block spanning added and context lines as a comment', () => {
    const hunks = [hunk([
      line('context', '/**', 1, 1),
      line('add', ' * Adds two numbers.', null, 2),
      line('context', ' * @param a first', 2, 3),
      line('delete', ' * old text', 3, null),
      line('context', ' */', 4, 4),
      line('context', 'export const sum = (a: number) => a;', 5, 5),
    ])];

    const tokens = run(hunkSources(hunks), tokenizer('typescript'));
    const map = buildSyntaxMap(hunks, tokens, false);

    expect(colorOf(map.get('context-1'), '/**')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('add-2'), 'Adds two numbers')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('context-3'), 'first')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('delete-3'), 'old text')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('context-4'), '*/')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('context-5'), 'sum')).not.toBe(COMMENT_GREEN);
  });

  it('carries the grammar state across chunks', () => {
    const lines = ['/*', ...Array.from({ length: 10 }, (_, i) => ` line ${i}`), '*/', 'int x = 1;'];
    const hunks = [hunk(lines.map((content, i) => line('add', content, null, i + 1)))];

    const tokens = run(hunkSources(hunks), tokenizer('java'), 3);

    for (let n = 1; n <= 12; n++) {
      expect(tokens.new.get(n)?.every((token) => token.color?.toUpperCase() === COMMENT_GREEN || !token.text.trim())).toBe(true);
    }
    expect(colorOf(tokens.new.get(13), 'int')).not.toBe(COMMENT_GREEN);
  });

  it('uses the whole file so a hunk opening inside a comment is still coloured, and keys every new line as context', () => {
    const newLines = ['/**', ' * Docs', ' * more', ' */', 'class A {}', ''];
    const oldLines = ['/**', ' * Docs', ' */', 'class A {}', ''];
    const hunks = [hunk([
      line('context', ' * Docs', 2, 2),
      line('add', ' * more', null, 3),
      line('context', ' */', 3, 4),
    ])];

    const plan = planSyntaxSources(hunks, { oldLines, newLines }, 1000);
    expect(plan.fullNew).toBe(true);
    const map = buildSyntaxMap(hunks, run(plan.sources, tokenizer('java')), plan.fullNew);

    expect(colorOf(map.get('context-2'), 'Docs')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('add-3'), 'more')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('context-1'), '/**')).toBe(COMMENT_GREEN);
    expect(colorOf(map.get('context-5'), 'class')).not.toBe(COMMENT_GREEN);
  });
});

describe('planSyntaxSources', () => {
  const hunks = [hunk([
    line('context', 'a', 1, 1),
    line('delete', 'b', 2, null),
    line('add', 'B', null, 2),
  ])];

  it('falls back to hunk lines for a side whose file does not match the diff', () => {
    expect(sideMatchesFile(hunks, 'new', ['a', 'X'])).toBe(false);
    const plan = planSyntaxSources(hunks, { oldLines: ['a', 'b', 'c'], newLines: ['a', 'X'] }, 1000);
    expect(plan.fullNew).toBe(false);
    expect(plan.sources).toEqual([
      { side: 'old', numbers: [1, 2, 3], lines: ['a', 'b', 'c'] },
      { side: 'new', numbers: [1, 2], lines: ['a', 'B'] },
    ]);
  });

  it('falls back to hunk lines when the file is too long or missing', () => {
    expect(planSyntaxSources(hunks, { oldLines: ['a', 'b', 'c'], newLines: ['a', 'B', 'c'] }, 2).fullNew).toBe(false);
    expect(planSyntaxSources(hunks, null, 1000).sources).toEqual(hunkSources(hunks));
  });

  it('skips a side the diff does not show', () => {
    const added = [hunk([line('add', 'x', null, 1)])];
    expect(planSyntaxSources(added, null, 1000).sources.map((source) => source.side)).toEqual(['new']);
  });
});
