const shown = { key: null as string | null };

/** Marks the guide on screen, so a finished run does not offer to open what is already open. `null` when none is. */
export function setGuideOnScreen(repoPath: string | null, ref: string | null) {
  shown.key = repoPath && ref ? `${repoPath}\u0000${ref}` : null;
}

export function isGuideOnScreen(repoPath: string, ref: string): boolean {
  return shown.key === `${repoPath}\u0000${ref}`;
}
