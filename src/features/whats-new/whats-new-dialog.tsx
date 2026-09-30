import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import dayjs from 'dayjs';
import { cn } from '../../lib/cn';
import { chord } from '../../lib/shortcuts';
import { reportIssue } from '../../lib/report-issue';
import { closeWhatsNew, openSettingsAt, useUi } from '../../lib/ui-store';
import { BrandLogo } from '../../components/icons/brand-logo';
import { KeyCaps } from '../../components/ui/key-caps';
import { XIcon } from '../../components/ui/icon';
import { buttonOutline } from '../../components/ui/button-styles';
import { openFind, useFind } from '../find/find-store';
import { WHATS_NEW, type WhatsNewAction, type WhatsNewItem } from '../../whats-new';

const RELEASES_URL = 'https://github.com/nilbuild/diffity/releases';

const actionButton = cn(buttonOutline, 'h-6 px-2 text-xs');

function openIgnoreSettings() {
  closeWhatsNew();
  openSettingsAt('general');
  setTimeout(() => document.getElementById('diff-ignore-rules')?.focus(), 50);
}

function openAppearanceSettings() {
  closeWhatsNew();
  openSettingsAt('general');
}

function tryFind() {
  closeWhatsNew();
  openFind();
}

function ItemAction(props: { action: WhatsNewAction }) {
  const { action } = props;
  const canFind = useFind((state) => !!state.source);

  if (action === 'find') {
    if (!canFind) {
      return <KeyCaps keys={[chord('F')]} className="mt-px" />;
    }
    return (
      <button type="button" className={actionButton} onClick={tryFind}>
        Try it
        <KeyCaps keys={[chord('F')]} className="-mr-0.5" />
      </button>
    );
  }
  if (action === 'ignore-settings') {
    return (
      <button type="button" className={actionButton} onClick={openIgnoreSettings}>
        Open settings
      </button>
    );
  }
  if (action === 'appearance-settings') {
    return (
      <button type="button" className={actionButton} onClick={openAppearanceSettings}>
        Open settings
      </button>
    );
  }
  return (
    <button type="button" className={actionButton} onClick={reportIssue}>
      Report an issue…
    </button>
  );
}

function Item(props: { item: WhatsNewItem }) {
  const { item } = props;

  return (
    <li className="flex gap-2.5 py-1.5">
      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-muted" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] leading-[19px] text-text">{item.text}</span>
          {item.action && <ItemAction action={item.action} />}
        </div>
        {item.detail && <p className="text-xs leading-snug text-text-muted">{item.detail}</p>}
        {item.example && (
          <pre className="mt-0.5 rounded-md bg-bg-secondary px-2.5 py-1.5 font-mono text-[11.5px] leading-[18px] text-text-secondary select-text">
            {item.example}
          </pre>
        )}
      </div>
    </li>
  );
}

function WhatsNewBody() {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') {
      return;
    }
    event.stopPropagation();
    closeWhatsNew();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] font-sans" onMouseDown={closeWhatsNew}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="What’s new in Diffity"
        tabIndex={-1}
        onKeyDown={handleKey}
        onMouseDown={(event) => event.stopPropagation()}
        className="mx-4 flex max-h-[78vh] w-[600px] max-w-full flex-col overflow-hidden rounded-xl bg-overlay text-text ring-1 ring-overlay-border outline-none"
      >
        <div className="flex items-center gap-2.5 border-b border-overlay-border px-4 py-2.5">
          <BrandLogo className="h-5 w-5 shrink-0" />
          <h2 className="flex-1 text-[13px] font-semibold">What’s new in Diffity</h2>
          <button
            type="button"
            onClick={closeWhatsNew}
            aria-label="Close"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {WHATS_NEW.map((release, index) => (
            <section key={release.version} className={cn('pt-4', index > 0 && 'mt-2 border-t border-border')}>
              <div className="mb-1 flex items-baseline gap-2">
                <h3 className="text-[13px] font-semibold text-text">Diffity {release.version}</h3>
                <span className="text-xs text-text-muted">{dayjs(release.date).format('D MMM YYYY')}</span>
                {index === 0 && (
                  <span className="rounded-full bg-accent/10 px-1.5 text-[11px] font-medium leading-4 text-accent">Latest</span>
                )}
              </div>
              <ul>
                {release.items.map((item) => (
                  <Item key={item.text} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-overlay-border px-4 py-2 text-xs text-text-muted">
          <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="hover:text-text hover:underline">
            All releases on GitHub
          </a>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

export function WhatsNewDialog() {
  const open = useUi((state) => state.whatsNewOpen);

  if (!open) {
    return null;
  }
  return <WhatsNewBody />;
}
