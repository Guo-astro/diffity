import { describe, expect, it } from 'vitest';
import { applyEvents, currentFile, filesRead, finalText, logFromMessages, modelFromMessages, toolCount } from '../src/features/claude/run-activity';
import type { ChatMessage } from '../src/lib/types';

const empty = { items: [], plan: [] };

describe('run activity', () => {
  it('joins streamed thought and text chunks', () => {
    const log = applyEvents(empty, [
      { type: 'thought', delta: 'Look at ' },
      { type: 'thought', delta: 'the runner.' },
      { type: 'text', messageId: 'm1', delta: 'All ' },
      { type: 'text', messageId: 'm1', delta: 'good.' },
      { type: 'text', messageId: 'm2', delta: 'Done.' },
    ], 1000);
    expect(log.items.map((item) => item.kind)).toEqual(['thought', 'text', 'text']);
    expect(log.items[0]).toMatchObject({ text: 'Look at the runner.', startedAt: 1000, endedAt: 1000 });
    expect(log.items[1]).toMatchObject({ text: 'All good.' });
    expect(finalText(log)).toBe('Done.');
  });

  it('applies chunks across batches', () => {
    const first = applyEvents(empty, [{ type: 'thought', delta: 'a' }], 1000);
    const second = applyEvents(first, [{ type: 'thought', delta: 'b' }, { type: 'toolCall', id: 't1', title: 'Read x', kind: 'read', status: 'pending', locations: [] }], 4000);
    expect(second.items[0]).toMatchObject({ text: 'ab', startedAt: 1000, endedAt: 4000 });
    expect(first.items[0]).toMatchObject({ text: 'a', endedAt: null });
  });

  it('patches tool calls by id and tracks the file being read', () => {
    let log = applyEvents(empty, [
      { type: 'toolCall', id: 't1', title: 'Read /repo/src/a.ts', kind: 'read', status: 'in_progress', locations: ['/repo/src/a.ts'] },
    ], 0);
    expect(currentFile(log, '/repo')).toBe('src/a.ts');
    log = applyEvents(log, [
      { type: 'toolCallUpdate', id: 't1', status: 'completed' },
      { type: 'toolCallUpdate', id: 'unknown', status: 'completed' },
      { type: 'toolCall', id: 't2', title: 'Read /repo/src/a.ts', kind: 'read', status: 'pending', locations: ['/repo/src/a.ts'] },
      { type: 'toolCall', id: 't3', title: 'grep foo', kind: 'search', status: 'completed', locations: [] },
    ], 0);
    expect(log.items[0]).toMatchObject({ status: 'completed' });
    expect(currentFile(log, '/repo')).toBeNull();
    expect(filesRead(log, '/repo')).toEqual(['src/a.ts']);
    expect(toolCount(log)).toBe(3);
  });

  it('keeps the latest plan', () => {
    const log = applyEvents(empty, [
      { type: 'plan', entries: [{ content: 'one', status: 'pending' }] },
      { type: 'plan', entries: [{ content: 'one', status: 'completed' }] },
    ], 0);
    expect(log.plan).toEqual([{ content: 'one', status: 'completed' }]);
  });

  it('rebuilds a saved chat from its agent turns', () => {
    const messages: ChatMessage[] = [
      { id: '1', chatId: 'c', role: 'user', content: { text: '', context: [] }, createdAt: '' },
      { id: '2', chatId: 'c', role: 'agent', content: [{ type: 'thought', delta: 'hm' }, { type: 'text', messageId: 'm', delta: 'ok' }], createdAt: '' },
    ];
    const log = logFromMessages(messages);
    expect(log.items.map((item) => item.kind)).toEqual(['thought', 'text']);
    expect(log.items[0]).toMatchObject({ startedAt: null });
  });

  it('reads the model of the latest turn that saved one', () => {
    const user = (id: string, model?: { model?: string; effort?: string }): ChatMessage => ({ id, chatId: 'c', role: 'user', content: { text: '', context: [], model }, createdAt: '' });
    expect(modelFromMessages([user('1')])).toBeNull();
    expect(modelFromMessages([user('1', { model: 'opus', effort: 'high' }), user('2')])).toEqual({ model: 'opus', effort: 'high' });
    expect(modelFromMessages([user('1', { model: 'opus' }), user('2', { model: 'sonnet' })])).toEqual({ model: 'sonnet' });
  });
});
