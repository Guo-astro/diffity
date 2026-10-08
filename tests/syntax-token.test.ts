import { describe, expect, it } from 'vitest';
import { tokensToHtml } from '../src/lib/syntax-token';

describe('tokensToHtml', () => {
  it('wraps coloured tokens in spans and leaves plain ones as text', () => {
    expect(tokensToHtml([{ text: 'const', color: '#D73A49' }, { text: ' x' }])).toBe('<span style="color:#D73A49">const</span> x');
  });

  it('escapes markup in code so it shows as text', () => {
    expect(tokensToHtml([{ text: '<img src=x onerror="alert(1)"> & ' }])).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; ');
  });

  it('escapes quotes in a colour so it cannot leave the style attribute', () => {
    expect(tokensToHtml([{ text: 'a', color: '"><script>' }])).toBe('<span style="color:&quot;&gt;&lt;script&gt;">a</span>');
  });

  it('renders an empty line as nothing', () => {
    expect(tokensToHtml([])).toBe('');
  });
});
