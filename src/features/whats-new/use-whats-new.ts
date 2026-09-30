import { useEffect } from 'react';
import { toast } from 'sonner';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from '../../lib/platform';
import * as tauri from '../../lib/tauri';
import { openWhatsNew } from '../../lib/ui-store';
import { canUpdate } from '../updates/updater';
import { shouldShowUpdateNotice } from '../../whats-new';

const LAST_SEEN_KEY = 'app.lastSeenVersion';

async function noticeAfterUpdate() {
  const [current, lastSeen, recent] = await Promise.all([
    getVersion(),
    tauri.getSetting(LAST_SEEN_KEY).catch(() => null),
    tauri.recentRepos().catch(() => []),
  ]);
  if (lastSeen === current) {
    return;
  }
  await tauri.setSetting(LAST_SEEN_KEY, current).catch(() => undefined);
  if (!shouldShowUpdateNotice({ lastSeen, current, returningUser: recent.length > 0 })) {
    return;
  }
  toast(`Diffity updated to ${current}`, {
    id: 'diffity-whats-new',
    duration: 20_000,
    action: { label: 'See what’s new', onClick: openWhatsNew },
  });
}

/** Help → What's New opens in the window it was picked from; the first launch after an update says so once. */
export function useWhatsNew() {
  useEffect(() => {
    if (!isTauri) {
      return;
    }
    const current = getCurrentWebviewWindow();
    const unlisten = current.listen('open-whats-new', openWhatsNew);
    if (canUpdate && current.label === 'main') {
      void noticeAfterUpdate();
    }
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);
}
