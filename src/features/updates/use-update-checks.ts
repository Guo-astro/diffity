import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from '../../lib/platform';
import { canUpdate, checkForUpdates, checkForUpdatesAndTell } from './updater';
import { FIRST_CHECK_DELAY_MS, RECHECK_EVERY_MS } from './update-policy';

/** Checks on launch and every few hours, from the main window only so extra repo windows don't each prompt. */
export function useUpdateChecks() {
  useEffect(() => {
    if (!canUpdate) {
      return;
    }
    if (getCurrentWindow().label !== 'main') {
      return;
    }
    const first = setTimeout(() => void checkForUpdates({ asked: false }), FIRST_CHECK_DELAY_MS);
    const every = setInterval(() => void checkForUpdates({ asked: false }), RECHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
}

/** Diffity → Check for Updates… answers in the window it was picked from. */
export function useCheckForUpdatesMenu() {
  useEffect(() => {
    if (!isTauri) {
      return;
    }
    const unlisten = getCurrentWebviewWindow().listen('check-for-updates', () => void checkForUpdatesAndTell());
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);
}
