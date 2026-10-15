/** GitHub-style suggested changes: a ```suggestion block in a comment holds the replacement for the thread's lines. */

export type SuggestionState = 'ready' | 'applied' | 'outdated' | 'unknown';

export interface SuggestionLine {
  kind: 'context' | 'del' | 'add';
  text: string;
  /** Line index in the suggested code for `add`, in the original otherwise. */
  index: number;
}

function lines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
  return normalized === '' ? [] : normalized.split('\n');
}

export function sameCode(a: string, b: string): boolean {
  return lines(a).join('\n') === lines(b).join('\n');
}

/** Whether `code` can still be applied over the thread's lines: `current` is what they read now, `anchor` what they read when commented on. */
export function suggestionState(code: string, current: string | undefined, anchor: string | undefined): SuggestionState {
  if (current === undefined) {
    return 'unknown';
  }
  if (sameCode(current, code)) {
    return 'applied';
  }
  if (anchor !== undefined && !sameCode(anchor, current)) {
    return 'outdated';
  }
  return 'ready';
}

/** Old vs suggested lines, with the unchanged lines at either end kept as context. */
export function suggestionLines(original: string, code: string): SuggestionLine[] {
  const before = lines(original);
  const after = lines(code);
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) {
    head++;
  }
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) {
    tail++;
  }
  const from = (source: string[], kind: SuggestionLine['kind'], start: number, end: number) =>
    source.slice(start, end).map((text, offset) => ({ kind, text, index: start + offset }));
  return [
    ...from(before, 'context', 0, head),
    ...from(before, 'del', head, before.length - tail),
    ...from(after, 'add', head, after.length - tail),
    ...from(before, 'context', before.length - tail, before.length),
  ];
}

/** Inserts a suggestion block seeded with `code` at `cursor`, on lines of its own; returns the new body and where its code starts. */
export function insertSuggestion(body: string, cursor: number, code: string): { body: string; cursor: number } {
  const before = body.slice(0, cursor);
  const after = body.slice(cursor);
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const trail = after === '' || after.startsWith('\n') ? '' : '\n';
  const open = `${lead}\`\`\`suggestion\n`;
  const block = `${open}${code.replace(/\n$/, '')}\n\`\`\`${trail}`;
  return { body: `${before}${block}${after}`, cursor: before.length + open.length };
}

const SUGGESTION_BLOCK = /^```suggestion[^\n]*\n([\s\S]*?)^```/gm;

/** The code of every ```suggestion block in a comment body. */
export function suggestionsIn(body: string): string[] {
  return [...body.matchAll(SUGGESTION_BLOCK)].map((match) => match[1]);
}

/** A thread whose lines now read one of its suggestions was applied, not outdated. */
export function appliedSuggestion(bodies: string[], current: string | undefined): boolean {
  if (current === undefined) {
    return false;
  }
  return bodies.some((body) => suggestionsIn(body).some((code) => sameCode(code, current)));
}
