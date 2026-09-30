import { create } from 'zustand';

export type DiffPalette = 'default' | 'colorblind';

const STORAGE_KEY = 'diffity-diff-palette';

function readPalette(): DiffPalette {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'colorblind' ? 'colorblind' : 'default';
  } catch {
    return 'default';
  }
}

/** `data-diff-palette` on the root swaps the add/remove colour tokens (see app.css). */
function applyPalette(palette: DiffPalette) {
  if (palette === 'default') {
    document.documentElement.removeAttribute('data-diff-palette');
    return;
  }
  document.documentElement.setAttribute('data-diff-palette', palette);
}

export const useDiffPalette = create<{ palette: DiffPalette }>(() => ({ palette: readPalette() }));

export function setDiffPalette(palette: DiffPalette) {
  try {
    if (palette === 'default') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, palette);
    }
  } catch {
    // Still applies for this session.
  }
  applyPalette(palette);
  useDiffPalette.setState({ palette });
}

if (typeof window !== 'undefined') {
  applyPalette(useDiffPalette.getState().palette);
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    const palette = readPalette();
    applyPalette(palette);
    useDiffPalette.setState({ palette });
  });
}
