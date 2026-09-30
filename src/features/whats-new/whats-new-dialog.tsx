import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import dayjs from 'dayjs';
import { closeWhatsNew, useUi } from '../../lib/ui-store';
import { BrandLogo } from '../../components/icons/brand-logo';
import { XIcon } from '../../components/ui/icon';
import { WHATS_NEW } from '../../whats-new';

const RELEASES_URL = 'https://github.com/nilbuild/diffity/releases';

function InlineText(props: { text: string }) {
  const { text } = props;

  return text.split('`').map((part, index) => {
    if (index % 2 === 0) {
      return part;
    }
    if (part.startsWith('⌘')) {
      return (
        <kbd
          key={index}
          className="mx-px rounded border border-b-2 border-control-border bg-bg px-1 font-mono text-[11px] text-text-secondary"
        >
          {part}
        </kbd>
      );
    }
    return (
      <code key={index} className="rounded bg-bg-tertiary px-1 font-mono text-[12px] text-text">
        {part}
      </code>
    );
  });
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
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {WHATS_NEW.map((release, index) => (
            <section
              key={release.version}
              className="mb-2.5 rounded-lg border border-border-muted bg-bg-secondary px-3.5 pt-3 pb-2 last:mb-0"
            >
              <div className="mb-2 flex items-center gap-2">
                <h3 className="rounded-full bg-accent/10 px-2 text-[12px] leading-5 font-semibold text-accent tabular-nums">
                  {release.version}
                </h3>
                {index === 0 && <span className="text-[11px] font-medium text-text-muted">Latest</span>}
                <span className="ml-auto text-xs text-text-muted">{dayjs(release.date).format('D MMM YYYY')}</span>
              </div>
              <ul>
                {release.items.map((item) => (
                  <li key={item} className="flex gap-2.5 pb-1.5 text-[13px] leading-5 text-text select-text">
                    <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-text-muted/60" aria-hidden="true" />
                    <span className="min-w-0">
                      <InlineText text={item} />
                    </span>
                  </li>
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
