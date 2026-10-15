/** The first line of prose in a comment, for the collapsed card: code blocks are summed up, not quoted. */
export function commentPreview(body: string): string {
  let inFence = false;
  let suggestion = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      suggestion ||= !inFence && line.slice(3).trim() === 'suggestion';
      inFence = !inFence;
      continue;
    }
    if (inFence || !line) {
      continue;
    }
    return line.replace(/^#+\s*|^[-*>]\s+/, '').replace(/[*_`]/g, '');
  }
  return suggestion ? 'Suggested change' : '';
}
