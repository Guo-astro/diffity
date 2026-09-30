/**
 * Release notes shown in Help → What's New. Newest first. Each release's bullets match its GitHub release notes;
 * add the next release here in the release commit, before tagging.
 */

export type WhatsNewAction = 'find' | 'ignore-settings' | 'appearance-settings' | 'report-issue';

export interface WhatsNewItem {
  text: string;
  /** Opens or points at the feature. */
  action?: WhatsNewAction;
  /** A short how-to under the bullet. */
  detail?: string;
  /** A code sample under the bullet, shown monospaced. */
  example?: string;
}

export interface WhatsNewRelease {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  items: WhatsNewItem[];
}

export const WHATS_NEW: WhatsNewRelease[] = [
  {
    version: '0.0.4',
    date: '2026-09-30',
    items: [
      { text: 'See what changed in each update from What’s New in the Help menu or ⌘K' },
      { text: 'Fixed Claude Code not being found when Diffity is opened from Finder or the Dock' },
      { text: 'Clearer message when Node.js is missing for the Claude features' },
    ],
  },
  {
    version: '0.0.3',
    date: '2026-09-30',
    items: [
      { text: 'Find anything in the whole diff with ⌘F, including collapsed and not-yet-loaded files', action: 'find' },
      {
        text: 'See which files changed since you marked them viewed, and show just those changes',
        detail: 'Mark a file viewed (R). If it changes later, its header says “Changed since you viewed it”; click it to see only what changed.',
      },
      {
        text: 'Hide generated files from diffs with a .diffityignore file or a list in Settings',
        action: 'ignore-settings',
        detail: 'Put a .diffityignore at the repo root. Gitignore syntax, one pattern per line:',
        example: 'dist/\n*.min.js\npnpm-lock.yaml',
      },
      { text: 'Colour-blind friendly diff colours in Settings', action: 'appearance-settings' },
      { text: 'Fixed multi-line comments and strings losing their syntax colour in the diff' },
    ],
  },
  {
    version: '0.0.2',
    date: '2026-09-30',
    items: [
      { text: 'Report an issue from the Help menu, ⌘K or Settings, with your app and macOS versions filled in', action: 'report-issue' },
      { text: 'Fixed dragging across lines sometimes not opening the comment box' },
      { text: 'Fixed quick drags selecting only the first line' },
      { text: 'Fixed the review panel briefly saying there’s nothing to post' },
      { text: 'Claude’s progress in a thread now lines up with the comments' },
      { text: 'Smaller download' },
    ],
  },
  {
    version: '0.0.1',
    date: '2026-09-30',
    items: [
      { text: 'Diffity is now a native Mac app, replacing the CLI and browser viewer' },
      { text: 'Comment on lines, ranges, files or the whole diff' },
      { text: '@claude in any comment gets an answer in that thread' },
      { text: 'Ask Claude to review, or send your comments to Claude to fix' },
      { text: 'Check out any pull request and post your review to GitHub' },
      { text: '⌘K for every action, ⌘P for files' },
      { text: 'Projects rail with ⌘1–9 to switch projects' },
      { text: 'Updates itself' },
    ],
  },
];

/** -1, 0 or 1; missing or non-numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Whether to say "Diffity updated to …" on launch. A fresh install says nothing. Someone who used the app before
 * this notice existed has no last-seen version, so their history stands in for it.
 */
export function shouldShowUpdateNotice(input: { lastSeen: string | null; current: string; returningUser: boolean }) {
  if (input.lastSeen === null) {
    return input.returningUser;
  }
  return compareVersions(input.current, input.lastSeen) > 0;
}
