import type { DiffHunk, DiffLine } from '@/lib/diff-parser';
import type { GrammarState } from 'shiki';
import type { SyntaxToken } from './syntax-token';

export type SyntaxSide = 'old' | 'new';

/** Consecutive lines of one side of a file, highlighted in one pass so multi-line constructs keep their colour. */
export interface SyntaxSource {
  side: SyntaxSide;
  numbers: number[];
  lines: string[];
}

export interface SideTokens {
  old: Map<number, SyntaxToken[]>;
  new: Map<number, SyntaxToken[]>;
}

export interface FileVersionLines {
  oldLines: string[] | null;
  newLines: string[] | null;
}

export type ChunkTokenizer = (code: string, state?: GrammarState) => { lines: SyntaxToken[][]; state: GrammarState | undefined } | null;

function onSide(line: DiffLine, side: SyntaxSide): boolean {
  return side === 'old' ? line.type !== 'add' : line.type !== 'delete';
}

function lineNumber(line: DiffLine, side: SyntaxSide): number | null {
  return side === 'old' ? line.oldLineNumber : line.newLineNumber;
}

/** Each hunk's old side (context + deleted) and new side (context + added), in order: the fallback without full files. */
export function hunkSources(hunks: DiffHunk[], sides: SyntaxSide[] = ['old', 'new']): SyntaxSource[] {
  const sources: SyntaxSource[] = [];
  for (const hunk of hunks) {
    for (const side of sides) {
      const source: SyntaxSource = { side, numbers: [], lines: [] };
      for (const line of hunk.lines) {
        const num = lineNumber(line, side);
        if (!onSide(line, side) || num === null) {
          continue;
        }
        source.numbers.push(num);
        source.lines.push(line.content);
      }
      if (source.lines.length > 0) {
        sources.push(source);
      }
    }
  }
  return sources;
}

export function fileSource(side: SyntaxSide, fileLines: string[]): SyntaxSource {
  return { side, numbers: fileLines.map((_, index) => index + 1), lines: fileLines };
}

/** Whether every diff line of `side` reads the same in `fileLines`, so the file's tokens can stand in for the hunks'. */
export function sideMatchesFile(hunks: DiffHunk[], side: SyntaxSide, fileLines: string[]): boolean {
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const num = lineNumber(line, side);
      if (!onSide(line, side) || num === null) {
        continue;
      }
      if (fileLines[num - 1] !== line.content) {
        return false;
      }
    }
  }
  return true;
}

/**
 * What to highlight for a file: each needed side as the whole file when it is available, matches the diff and has at
 * most `maxFileLines` lines; otherwise that side's hunk lines.
 */
export function planSyntaxSources(hunks: DiffHunk[], versions: FileVersionLines | null, maxFileLines: number): { sources: SyntaxSource[]; fullNew: boolean } {
  let needOld = false;
  let needNew = false;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'delete') {
        needOld = true;
      } else {
        needNew = true;
      }
    }
  }

  const sources: SyntaxSource[] = [];
  const fallback: SyntaxSide[] = [];
  let fullNew = false;
  const plan = (side: SyntaxSide, fileLines: string[] | null | undefined) => {
    if (fileLines && fileLines.length <= maxFileLines && sideMatchesFile(hunks, side, fileLines)) {
      sources.push(fileSource(side, fileLines));
      fullNew = fullNew || side === 'new';
      return;
    }
    fallback.push(side);
  };
  if (needOld) {
    plan('old', versions?.oldLines);
  }
  if (needNew) {
    plan('new', versions?.newLines);
  }
  if (fallback.length > 0) {
    sources.push(...hunkSources(hunks, fallback));
  }
  return { sources, fullNew };
}

/**
 * Tokenizes the sources into `into`, `chunkLines` lines per step, carrying the grammar state across steps. Yields
 * after each step so a caller can spread the work over idle time; `into` holds every finished line meanwhile.
 */
export function* tokenizeSources(sources: SyntaxSource[], tokenize: ChunkTokenizer, into: SideTokens, chunkLines = 100): Generator<void, void> {
  for (const source of sources) {
    const target = into[source.side];
    let state: GrammarState | undefined;
    for (let start = 0; start < source.lines.length; start += chunkLines) {
      const end = Math.min(start + chunkLines, source.lines.length);
      const result = tokenize(source.lines.slice(start, end).join('\n'), state);
      if (!result) {
        return;
      }
      for (let i = start; i < end; i++) {
        const tokens = result.lines[i - start];
        if (tokens) {
          target.set(source.numbers[i], tokens);
        }
      }
      state = result.state;
      yield;
    }
  }
}

/**
 * The per-row syntax map the diff renders from (`type-number`, deleted rows by old number, the rest by new). With
 * `allContext`, every tokenized new-side line is also keyed as a context row, so expanded context reuses them.
 */
export function buildSyntaxMap(hunks: DiffHunk[], tokens: SideTokens, allContext: boolean): Map<string, SyntaxToken[]> {
  const map = new Map<string, SyntaxToken[]>();
  if (allContext) {
    for (const [num, lineTokens] of tokens.new) {
      map.set(`context-${num}`, lineTokens);
    }
  }
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'delete') {
        const found = line.oldLineNumber !== null ? tokens.old.get(line.oldLineNumber) : undefined;
        if (found) {
          map.set(`delete-${line.oldLineNumber}`, found);
        }
        continue;
      }
      const found = (line.newLineNumber !== null ? tokens.new.get(line.newLineNumber) : undefined)
        ?? (line.type === 'context' && line.oldLineNumber !== null ? tokens.old.get(line.oldLineNumber) : undefined);
      if (found) {
        map.set(`${line.type}-${line.newLineNumber}`, found);
      }
    }
  }
  return map;
}

/** Files with more rows than this are not syntax highlighted at all. */
export const HIGHLIGHT_MAX_ROWS = 10000;
/** Main-thread budget per highlighting step; the rest waits for the next task so scrolling stays smooth. */
const HIGHLIGHT_BUDGET_MS = 8;
/** How often finished lines are handed to the view while the rest is still being highlighted. */
const HIGHLIGHT_COMMIT_MS = 400;

/**
 * Drives `work` in small steps over later tasks: `onProgress` now and then while it runs, `onDone` once it finishes.
 * Returns a cancel function.
 */
export function runInSteps(work: Generator<void, void>, delayMs: number, onProgress: () => void, onDone: () => void): () => void {
  let cancelled = false;
  let timer = 0;
  let lastCommit = performance.now();

  const step = () => {
    if (cancelled) {
      return;
    }
    const deadline = performance.now() + HIGHLIGHT_BUDGET_MS;
    while (performance.now() < deadline) {
      if (work.next().done) {
        onDone();
        return;
      }
    }
    if (performance.now() - lastCommit > HIGHLIGHT_COMMIT_MS) {
      lastCommit = performance.now();
      onProgress();
    }
    timer = window.setTimeout(step, 0);
  };

  timer = window.setTimeout(step, delayMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
