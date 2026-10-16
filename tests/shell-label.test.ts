import { describe, expect, it } from 'vitest';
import { describeShell, splitShell } from '../src/features/claude/shell-label';

describe('shell labels', () => {
  it('splits at joiners outside quotes', () => {
    expect(splitShell(`grep -n "a\\|b" x.ts | head -5; ls && echo "x && y"`)).toEqual([
      { text: 'grep -n "a\\|b" x.ts', joiner: '|' },
      { text: 'head -5', joiner: ';' },
      { text: 'ls', joiner: '&&' },
      { text: 'echo "x && y"', joiner: null },
    ]);
  });

  it('names grep searches by their terms and scope', () => {
    expect(describeShell(`grep -n "firstLine\\|currentFile\\|goToThread" src/features/claude/activity-panel.tsx`))
      .toMatchObject({ verb: 'Searched for', subject: 'firstLine, currentFile, goToThread in activity-panel.tsx', more: 0 });
    expect(describeShell(`grep -rn "'chats'" src | grep -v "queryKey"`)).toMatchObject({ verb: 'Searched for', subject: "'chats' in src", more: 0 });
    expect(describeShell(`grep -rn "openActivity\\b\\|toggleActivity" src --include=*.ts; grep -n "byRepo" src/a.ts | head -20`))
      .toMatchObject({ verb: 'Searched for', subject: 'openActivity, toggleActivity in src', more: 1 });
  });

  it('reads sed ranges and cat as file reads', () => {
    expect(describeShell('sed -n 205,240p src-tauri/src/agents/session.rs')).toMatchObject({ verb: 'Read', subject: 'src-tauri/src/agents/session.rs (205 - 240)', subjectKind: 'path' });
    expect(describeShell('cat cart.js 2>/dev/null')).toMatchObject({ verb: 'Read', subject: 'cart.js', subjectKind: 'path' });
  });

  it('skips cd and recognizes git and tests', () => {
    expect(describeShell('cd /repo && git log --oneline -5')).toMatchObject({ verb: 'Checked git history', more: 0 });
    expect(describeShell('node --test cart.test.js 2>&1 | tail -12')).toMatchObject({ verb: 'Ran tests', more: 0 });
    expect(describeShell('ls -la && cat cart.js && cat package.json 2>/dev/null')).toMatchObject({ verb: 'Listed files', more: 2 });
  });

  it('falls back to the command itself', () => {
    expect(describeShell('make release')).toMatchObject({ verb: 'Ran', subject: 'make release', subjectKind: 'code' });
  });
});
