export interface SyntaxToken {
  text: string;
  color?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * One highlighted line as HTML. Code blocks render their tokens this way rather than as React spans: WebKit only frees
 * elements made from JS on a full GC, so thousands of spans per markdown preview piled up as memory (issue #56).
 */
export function tokensToHtml(tokens: SyntaxToken[]): string {
  let html = '';
  for (const token of tokens) {
    const text = escapeHtml(token.text);
    html += token.color ? `<span style="color:${escapeHtml(token.color)}">${text}</span>` : text;
  }
  return html;
}
