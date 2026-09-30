import { toast } from 'sonner';
import { isTauri } from './platform';
import * as tauri from './tauri';

const BUG_REPORT_URL = 'https://github.com/nilbuild/diffity/issues/new?template=bug_report.yml';

/** Opens the GitHub bug-report form with the app, macOS and chip fields pre-filled. */
export function reportIssue() {
  if (!isTauri) {
    window.open(BUG_REPORT_URL, '_blank', 'noopener');
    return;
  }
  tauri.reportIssue().catch((error) => toast.error('Could not open GitHub', { description: tauri.errorMessage(error) }));
}
