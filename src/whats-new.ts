/**
 * What changed in each release, as Help → What's New draws it. The notes are the GitHub release's own body, read
 * from the releases API when the dialog opens, so the release is the only copy and an edit to it reaches every
 * installed version.
 */

export const RELEASES_URL = 'https://github.com/nilbuild/diffity/releases';
export const RELEASES_API = 'https://api.github.com/repos/nilbuild/diffity/releases?per_page=10';

export interface Release {
  version: string;
  /** ISO instant, when GitHub published it. */
  date: string;
  /**
   * One note a line of the body, its `- ` dropped. `backticks` show as code, or as a key when they hold a shortcut;
   * `[text](https://…)` is a link out, to the web only. Nothing else in Markdown is read.
   */
  items: string[];
}

/** A release body as its notes: one per non-empty line, list marks off. */
export function notesFrom(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
}

interface GitHubRelease {
  tag_name?: unknown;
  body?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

/** The releases API's answer as releases, newest first; anything that will not read as a published release is left out. */
export function releasesFrom(answer: unknown): Release[] {
  if (!Array.isArray(answer)) {
    return [];
  }
  return (answer as GitHubRelease[])
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        typeof release.tag_name === 'string' &&
        typeof release.published_at === 'string',
    )
    .map((release) => ({
      version: String(release.tag_name).replace(/^v/, ''),
      date: String(release.published_at),
      items: notesFrom(typeof release.body === 'string' ? release.body : ''),
    }));
}

export type NotePart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'code'; text: string }
  | { kind: 'key'; text: string };

const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|`([^`\n]+)`/g;

function isWebAddress(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * One item split into what it draws as. A link to anything but the web stays the text it
 * was written as, so a note can never carry a `javascript:` address into the app.
 */
export function noteParts(item: string): NotePart[] {
  const parts: NotePart[] = [];
  let at = 0;

  for (const match of item.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > at) {
      parts.push({ kind: 'text', text: item.slice(at, index) });
    }
    const [whole, linkText, href, code] = match;
    if (linkText !== undefined && href !== undefined) {
      parts.push(isWebAddress(href) ? { kind: 'link', text: linkText, href } : { kind: 'text', text: whole });
    } else if (code !== undefined) {
      parts.push({ kind: code.startsWith('⌘') ? 'key' : 'code', text: code });
    }
    at = index + whole.length;
  }

  if (at < item.length) {
    parts.push({ kind: 'text', text: item.slice(at) });
  }
  return parts;
}

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
