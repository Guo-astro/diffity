export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** The "Diffity Dev" test build (`DIFFITY_CHANNEL=dev`, see src-tauri/tauri.dev.conf.json). */
export const isDevBuild = import.meta.env.DIFFITY_CHANNEL === 'dev';
export const shouldUseMockApi = import.meta.env.VITE_MOCK === '1' || !isTauri;

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const modKey = isMac ? '⌘' : 'Ctrl';
