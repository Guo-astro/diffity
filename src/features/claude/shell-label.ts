export interface ShellStep {
  text: string;
  /** What joins this step to the next one: `&&`, `||`, `;` or `|`. */
  joiner: string | null;
}

export interface ShellSummary {
  verb: string;
  subject: string | null;
  subjectKind: 'code' | 'path' | 'text';
  /** Other commands chained after the one summarized; pipes into filters like `head` don't count. */
  more: number;
}

/** Splits a command line at `&&`, `||`, `;`, `|` and newlines that sit outside quotes. */
export function splitShell(command: string): ShellStep[] {
  const steps: ShellStep[] = [];
  let current = '';
  let quote: string | null = null;
  const push = (joiner: string | null) => {
    if (current.trim()) {
      steps.push({ text: current.trim(), joiner });
    } else if (joiner && steps.length > 0) {
      steps[steps.length - 1].joiner = joiner;
    }
    current = '';
  };
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const next = command[index + 1];
    if (quote) {
      current += char;
      if (char === '\\' && quote === '"' && next !== undefined) {
        current += next;
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '\\' && next !== undefined) {
      current += char + next;
      index += 1;
      continue;
    }
    if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
      push(char + next);
      index += 1;
      continue;
    }
    if (char === '|' || char === ';' || char === '\n') {
      push(char === '\n' ? ';' : char);
      continue;
    }
    current += char;
  }
  push(null);
  if (steps.length > 0) {
    steps[steps.length - 1].joiner = null;
  }
  return steps;
}

/** Shell words with quotes removed; redirections like `2>/dev/null` are dropped. */
function words(step: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  let started = false;
  for (let index = 0; index < step.length; index += 1) {
    const char = step[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"' && (step[index + 1] === '"' || step[index + 1] === '\\')) {
        current += step[index + 1];
        index += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) {
        out.push(current);
      }
      current = '';
      started = false;
      continue;
    }
    current += char;
    started = true;
  }
  if (started) {
    out.push(current);
  }
  return out.filter((word) => !/^\d?>>?/.test(word) && !/^&>/.test(word));
}

const FILTERS = new Set(['head', 'tail', 'grep', 'sort', 'uniq', 'wc', 'cut', 'awk', 'tr', 'less', 'cat', 'jq', 'column', 'xargs', 'sed', 'nl']);

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function baseName(path: string) {
  return path.split('/').filter(Boolean).pop() ?? path;
}

/** Non-flag arguments; `valued` flags swallow the word after them. */
function operands(args: string[], valued: string[] = []): string[] {
  const out: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      out.push(...args.slice(index + 1));
      break;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      if (valued.includes(arg)) {
        index += 1;
      }
      continue;
    }
    out.push(arg);
  }
  return out;
}

function searchTerms(pattern: string, extended: boolean): string[] {
  const parts = extended ? pattern.split('|') : pattern.split('\\|');
  return parts
    .map((part) => part.replace(/\\b|\\w\+?|\\s\*?|\^|\$|\\\(|\\\)|[()]/g, '').replace(/\\(.)/g, '$1').trim())
    .filter(Boolean);
}

function describeSearch(tool: string, args: string[]): ShellSummary {
  const extended = tool === 'rg' || tool === 'egrep' || args.some((arg) => /^-[a-zA-Z]*E/.test(arg));
  const explicit = args.findIndex((arg) => arg === '-e');
  const valued = ['-e', '-A', '-B', '-C', '-m', '--include', '--exclude', '--exclude-dir', '-g', '--glob', '-t', '--type'];
  const rest = operands(args.filter((arg) => !/^--(include|exclude|exclude-dir|glob)=/.test(arg)), valued);
  const pattern = explicit !== -1 ? args[explicit + 1] : rest.shift();
  if (!pattern) {
    return { verb: 'Searched', subject: null, subjectKind: 'text', more: 0 };
  }
  const terms = searchTerms(pattern, extended);
  const shown = terms.length > 3 ? `${terms.slice(0, 3).join(', ')} +${terms.length - 3}` : terms.join(', ');
  const where = rest.filter((path) => path !== '.');
  const scope = where.length === 1 ? ` in ${baseName(where[0])}` : where.length > 1 ? ` in ${plural(where.length, 'path', 'paths')}` : '';
  return { verb: 'Searched for', subject: `${shown || pattern}${scope}`, subjectKind: 'code', more: 0 };
}

function describeRead(args: string[], range: string | null): ShellSummary {
  const files = operands(args, ['-n', '-c']);
  if (files.length === 0) {
    return { verb: 'Read', subject: null, subjectKind: 'text', more: 0 };
  }
  if (files.length > 1) {
    return { verb: 'Read', subject: `${files.map(baseName).slice(0, 3).join(', ')}${files.length > 3 ? ` +${files.length - 3}` : ''}`, subjectKind: 'code', more: 0 };
  }
  return { verb: 'Read', subject: range ? `${files[0]} (${range})` : files[0], subjectKind: 'path', more: 0 };
}

const GIT: Record<string, string> = {
  log: 'Checked git history',
  status: 'Checked git status',
  diff: 'Looked at the diff',
  show: 'Looked at a commit',
  blame: 'Checked who changed',
  branch: 'Listed branches',
  'ls-files': 'Listed tracked files',
  'rev-parse': 'Looked up a ref',
  stash: 'Stashed changes',
  add: 'Staged changes',
  commit: 'Committed',
  checkout: 'Checked out',
  switch: 'Switched branch',
  fetch: 'Fetched',
  pull: 'Pulled',
  push: 'Pushed',
};

function describeGit(args: string[]): ShellSummary {
  let index = 0;
  while (args[index] === '-C' || args[index]?.startsWith('-')) {
    index += args[index] === '-C' ? 2 : 1;
  }
  const sub = args[index];
  const rest = args.slice(index + 1);
  if (!sub) {
    return { verb: 'Ran git', subject: null, subjectKind: 'text', more: 0 };
  }
  if (sub === 'grep') {
    return describeSearch('grep', rest);
  }
  const files = operands(rest, ['-n', '-U', '--format', '--pretty']).filter((arg) => arg.includes('/') || arg.includes('.'));
  const verb = GIT[sub];
  if (!verb) {
    return { verb: 'Ran', subject: `git ${sub}`, subjectKind: 'code', more: 0 };
  }
  if ((sub === 'blame' || sub === 'diff' || sub === 'log') && files.length === 1) {
    return { verb: sub === 'blame' ? 'Checked who changed' : verb, subject: files[0], subjectKind: 'path', more: 0 };
  }
  return { verb, subject: null, subjectKind: 'text', more: 0 };
}

function isTest(tool: string, args: string[]) {
  if (['vitest', 'jest', 'pytest', 'mocha', 'rspec'].includes(tool)) {
    return true;
  }
  if (tool === 'node' && args.includes('--test')) {
    return true;
  }
  if (['cargo', 'go', 'deno', 'bun', 'dotnet', 'mix'].includes(tool) && args[0] === 'test') {
    return true;
  }
  if (['npm', 'pnpm', 'yarn'].includes(tool)) {
    return args[0] === 'test' || args[0] === 't' || (args[0] === 'run' && /test/.test(args[1] ?? '')) || /^test/.test(args[0] ?? '');
  }
  return false;
}

function describeStep(step: string): ShellSummary {
  let all = words(step);
  while (all.length > 0 && /^[A-Z_][A-Z0-9_]*=/.test(all[0])) {
    all = all.slice(1);
  }
  if (all[0] === 'npx' || all[0] === 'sudo' || all[0] === 'time') {
    all = all.slice(all[1] === '--no-install' ? 2 : 1);
  }
  const [rawTool, ...args] = all;
  if (!rawTool) {
    return { verb: 'Ran', subject: step, subjectKind: 'code', more: 0 };
  }
  const tool = baseName(rawTool);

  if (isTest(tool, args)) {
    return { verb: 'Ran tests', subject: null, subjectKind: 'text', more: 0 };
  }
  switch (tool) {
    case 'grep':
    case 'egrep':
    case 'rg':
    case 'ag':
      return describeSearch(tool, args);
    case 'cat':
    case 'bat':
    case 'less':
    case 'head':
    case 'tail':
    case 'nl':
      return describeRead(args, null);
    case 'sed': {
      const range = args.find((arg) => /^\d+(,\d+)?p$/.test(arg));
      if (range && args.includes('-n')) {
        const [from, to] = range.slice(0, -1).split(',');
        return describeRead(args.filter((arg) => arg !== range && arg !== '-n'), to ? `${from} - ${to}` : from);
      }
      return { verb: 'Ran', subject: step, subjectKind: 'code', more: 0 };
    }
    case 'ls':
    case 'tree': {
      const dirs = operands(args, ['-L', '-I']);
      return { verb: 'Listed files', subject: dirs.length > 0 ? `in ${dirs.map(baseName).join(', ')}` : null, subjectKind: 'text', more: 0 };
    }
    case 'find':
    case 'fd': {
      const name = args[args.indexOf('-name') + 1] ?? args[args.indexOf('-iname') + 1];
      return { verb: 'Looked for files', subject: args.includes('-name') || args.includes('-iname') ? name : null, subjectKind: 'code', more: 0 };
    }
    case 'git':
      return describeGit(args);
    case 'gh':
      return { verb: 'Checked GitHub', subject: args.slice(0, 2).join(' ') || null, subjectKind: 'code', more: 0 };
    case 'tsc':
      return { verb: 'Type-checked', subject: null, subjectKind: 'text', more: 0 };
    case 'eslint':
    case 'biome':
    case 'clippy':
      return { verb: 'Linted', subject: null, subjectKind: 'text', more: 0 };
    case 'wc':
      return { verb: 'Counted lines', subject: operands(args).map(baseName).join(', ') || null, subjectKind: 'code', more: 0 };
    case 'mkdir':
      return { verb: 'Made a folder', subject: operands(args).join(' ') || null, subjectKind: 'code', more: 0 };
    case 'rm':
      return { verb: 'Deleted', subject: operands(args).join(' ') || null, subjectKind: 'code', more: 0 };
    case 'cargo':
      if (args[0] === 'build' || args[0] === 'check') {
        return { verb: args[0] === 'build' ? 'Built' : 'Checked the build', subject: null, subjectKind: 'text', more: 0 };
      }
      break;
  }
  return { verb: 'Ran', subject: step, subjectKind: 'code', more: 0 };
}

/** One line on what a shell command does, from its first real step: "Searched for x in y", "Read a.ts (10 - 40)". */
export function describeShell(command: string): ShellSummary {
  const steps = splitShell(command);
  const main: string[] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const tool = baseName(words(step.text)[0] ?? '');
    if (tool === 'cd' || tool === 'echo' || tool === 'true' || tool === 'export' || tool === 'set') {
      continue;
    }
    if (index > 0 && steps[index - 1].joiner === '|' && FILTERS.has(tool)) {
      continue;
    }
    main.push(step.text);
  }
  if (main.length === 0) {
    return { verb: 'Ran', subject: command, subjectKind: 'code', more: 0 };
  }
  return { ...describeStep(main[0]), more: main.length - 1 };
}
