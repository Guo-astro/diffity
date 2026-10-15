import { describe, expect, it } from 'vitest';
import { commentPreview } from '../src/components/comments/comment-preview';
import { appliedSuggestion, insertSuggestion, suggestionLines, suggestionState, suggestionsIn } from '../src/features/suggestions/suggestion';

describe('suggestionState', () => {
  it('is ready while the lines still read what was commented on', () => {
    expect(suggestionState('b', 'a', 'a')).toBe('ready');
    expect(suggestionState('b', 'a', undefined)).toBe('ready');
  });

  it('is applied once the lines read the suggestion', () => {
    expect(suggestionState('b\n', 'b', 'a')).toBe('applied');
  });

  it('is outdated when the lines changed some other way', () => {
    expect(suggestionState('b', 'c', 'a')).toBe('outdated');
  });

  it('is unknown without the current lines', () => {
    expect(suggestionState('b', undefined, 'a')).toBe('unknown');
  });
});

describe('suggestionLines', () => {
  it('keeps unchanged lines at either end as context', () => {
    expect(suggestionLines('a\nb\nc', 'a\nB\nX\nc')).toEqual([
      { kind: 'context', text: 'a', index: 0 },
      { kind: 'del', text: 'b', index: 1 },
      { kind: 'add', text: 'B', index: 1 },
      { kind: 'add', text: 'X', index: 2 },
      { kind: 'context', text: 'c', index: 2 },
    ]);
  });

  it('shows a deletion as removed lines only', () => {
    expect(suggestionLines('a\nb', '')).toEqual([
      { kind: 'del', text: 'a', index: 0 },
      { kind: 'del', text: 'b', index: 1 },
    ]);
  });
});

describe('insertSuggestion', () => {
  it('puts the block on its own lines and the cursor at its code', () => {
    const result = insertSuggestion('Rename this.', 12, 'const a = 1;');
    expect(result.body).toBe('Rename this.\n```suggestion\nconst a = 1;\n```');
    expect(result.body.slice(result.cursor)).toBe('const a = 1;\n```');
  });

  it('inserts into an empty body', () => {
    expect(insertSuggestion('', 0, 'x\n').body).toBe('```suggestion\nx\n```');
  });
});

describe('appliedSuggestion', () => {
  it('finds a suggestion the lines now read', () => {
    const body = 'Start at one.\n```suggestion\nfor (var i = 1;) {\n```\nThanks';
    expect(appliedSuggestion([body], 'for (var i = 1;) {')).toBe(true);
    expect(appliedSuggestion([body], 'for (var i = 2;) {')).toBe(false);
    expect(appliedSuggestion(['no block'], 'x')).toBe(false);
  });

  it('treats an empty block as deleting the lines', () => {
    expect(suggestionsIn('```suggestion\n```')).toEqual(['']);
  });
});

describe('commentPreview', () => {
  it('takes the first line of prose', () => {
    expect(commentPreview('**Must fix:** the loop skips `items[0]`.\n\nMore detail')).toBe('Must fix: the loop skips items[0].');
  });

  it('skips code and names a lone suggestion', () => {
    expect(commentPreview('```ts\nconst a = 1;\n```\nThen this')).toBe('Then this');
    expect(commentPreview('```suggestion\nx\n```')).toBe('Suggested change');
  });
});
