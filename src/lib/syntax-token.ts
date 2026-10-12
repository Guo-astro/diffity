export interface SyntaxToken {
  text: string;
  color?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const colorRules = new Set<string>();
let colorSheet: CSSStyleSheet | null = null;

/**
 * A class for a token color, its rule added on first use. Shared classes let WebKit share computed style between the
 * spans of a code block; with an inline `style` on each it resolves every span on its own, which took seconds on long
 * markdown previews.
 */
function colorClass(color: string): string | null {
  if (!HEX_COLOR.test(color)) {
    return null;
  }
  const name = `c-${color.slice(1).toLowerCase()}`;
  if (!colorRules.has(name) && typeof document !== 'undefined') {
    if (!colorSheet) {
      const style = document.createElement('style');
      document.head.appendChild(style);
      colorSheet = style.sheet;
    }
    colorSheet?.insertRule(`.${name}{color:${color}}`);
    colorRules.add(name);
  }
  return name;
}

/**
 * One highlighted line as HTML. Code blocks render their tokens this way rather than as React spans: WebKit only frees
 * elements made from JS on a full GC, so thousands of spans per markdown preview piled up as memory (issue #56).
 */
export function tokensToHtml(tokens: SyntaxToken[]): string {
  let html = '';
  for (const token of tokens) {
    const text = escapeHtml(token.text);
    if (!token.color) {
      html += text;
      continue;
    }
    const name = colorClass(token.color);
    html += name ? `<span class="${name}">${text}</span>` : `<span style="color:${escapeHtml(token.color)}">${text}</span>`;
  }
  return html;
}
