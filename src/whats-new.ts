/**
 * Release notes shown in Help → What's New. Newest first. Each release's bullets match its GitHub release notes;
 * add the next release here in the release commit, before tagging.
 */

export interface WhatsNewRelease {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Plain text; `backticks` show as code, or as a key when they hold a shortcut. */
  items: string[];
}

export const WHATS_NEW: WhatsNewRelease[] = [
  {
    version: '0.0.5',
    date: '2026-09-30',
    items: [
      'Check for updates from the Diffity menu or `⌘K`',
      'Simpler What’s New, with each release’s notes as a plain list',
      'Close a notification by swiping it away, with the × shown on hover',
      'The update notification no longer shows buttons while it installs',
      'Fixed an empty “Results” header in `⌘K` when nothing matches',
    ],
  },
  {
    version: '0.0.4',
    date: '2026-09-30',
    items: [
      'See what changed in each update from What’s New in the Help menu or `⌘K`',
      'Fixed Claude Code not being found when Diffity is opened from Finder or the Dock',
      'Clearer message when Node.js is missing for the Claude features',
    ],
  },
  {
    version: '0.0.3',
    date: '2026-09-30',
    items: [
      'Find anything in the whole diff with `⌘F`, including collapsed and not-yet-loaded files',
      'See which files changed since you marked them viewed, and show just those changes',
      'Hide generated files from diffs with a `.diffityignore` file or a list in Settings',
      'Colour-blind friendly diff colours in Settings',
      'Fixed multi-line comments and strings losing their syntax colour in the diff',
    ],
  },
  {
    version: '0.0.2',
    date: '2026-09-30',
    items: [
      'Report an issue from the Help menu, `⌘K` or Settings, with your app and macOS versions filled in',
      'Fixed dragging across lines sometimes not opening the comment box',
      'Fixed quick drags selecting only the first line',
      'Fixed the review panel briefly saying there’s nothing to post',
      'Claude’s progress in a thread now lines up with the comments',
      'Smaller download',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-09-30',
    items: [
      'Diffity is now a native Mac app, replacing the CLI and browser viewer',
      'Comment on lines, ranges, files or the whole diff',
      '@claude in any comment gets an answer in that thread',
      'Ask Claude to review, or send your comments to Claude to fix',
      'Check out any pull request and post your review to GitHub',
      '`⌘K` for every action, `⌘P` for files',
      'Projects rail with `⌘1–9` to switch projects',
      'Updates itself',
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
