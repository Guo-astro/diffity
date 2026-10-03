import { describe, it, expect } from 'vitest';
import { agentOfComments } from '../src/features/claude/claude-runner';
import { pickForAgent, resolvePick } from '../src/features/claude/model-setting';

const user = (body: string) => ({ authorType: 'user', authorName: 'You', body });
const agent = (name: string) => ({ authorType: 'agent', authorName: name, body: 'Done.' });
const info = (id: string, installed: boolean, authenticated: boolean | null = true) => ({ id, name: id, installed, binaryPath: null, authenticated, note: null });

describe('agentOfComments', () => {
  it('follows the newest mention or agent reply', () => {
    expect(agentOfComments([user('@codex why?')])).toBe('codex');
    expect(agentOfComments([user('@codex why?'), agent('Codex'), user('and this?')])).toBe('codex');
    expect(agentOfComments([user('@codex why?'), agent('Codex'), user('@claude second opinion')])).toBe('claude');
    expect(agentOfComments([agent('Claude Code'), user('thanks')])).toBe('claude');
    expect(agentOfComments([user('plain comment')])).toBe(null);
  });
});

describe('resolvePick', () => {
  it('keeps a usable saved agent, else falls back to the first usable one', () => {
    expect(resolvePick({ agent: 'codex', model: 'gpt' }, [info('claude', true), info('codex', true)])).toEqual({ agent: 'codex', model: 'gpt', effort: undefined });
    expect(resolvePick({ agent: 'claude', model: 'opus' }, [info('claude', false), info('codex', true)])).toEqual({ agent: 'codex' });
    expect(resolvePick({}, [info('claude', true, false), info('codex', true)])).toEqual({ agent: 'codex' });
    expect(resolvePick({}, [info('claude', true), info('codex', true)])).toEqual({ agent: 'claude' });
    expect(resolvePick({ agent: 'codex' }, [])).toEqual({ agent: 'codex', model: undefined, effort: undefined });
    expect(resolvePick({}, [])).toEqual({ agent: 'claude' });
  });

  it('drops the model when another agent takes the run', () => {
    expect(pickForAgent({ agent: 'claude', model: 'opus' }, 'codex')).toEqual({ agent: 'codex' });
    expect(pickForAgent({ agent: 'claude', model: 'opus' }, 'claude')).toEqual({ agent: 'claude', model: 'opus' });
  });
});
