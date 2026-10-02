import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import dayjs from 'dayjs';
import { closeWhatsNew, useUi } from '../../lib/ui-store';
import { BrandLogo } from '../../components/icons/brand-logo';
import { XIcon } from '../../components/ui/icon';
import { RELEASES_URL, noteParts } from '../../whats-new';
import { loadReleases, useReleases } from './releases';

function InlineText(props: { text: string }) {
  const { text } = props;

  return noteParts(text).map((part, index) => {
    if (part.kind === 'link') {
      return (
        <a
          key={index}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text underline decoration-text-muted/50 underline-offset-2 hover:decoration-text"
        >
          {part.text}
        </a>
      );
    }
    if (part.kind === 'key') {
      return (
        <kbd
          key={index}
          className="mx-px rounded border border-b-2 border-control-border bg-bg px-1 font-mono text-[11px] text-text-secondary"
        >
          {part.text}
        </kbd>
      );
    }
    if (part.kind === 'code') {
      return (
        <code key={index} className="rounded bg-bg-tertiary px-1 font-mono text-[12px] text-text">
          {part.text}
        </code>
      );
    }
    return part.text;
  });
}

function WhatsNewBody() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const read = useReleases();

  useEffect(() => {
    dialogRef.current?.focus();
    void loadReleases();
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
          {read.kind === 'loading' && <p className="py-6 text-center text-[13px] text-text-muted">Loading…</p>}
          {read.kind === 'failed' && (
            <p className="py-6 text-center text-[13px] text-text-muted">
              Couldn’t load the release notes. They’re on{' '}
              <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-text underline">
                GitHub
              </a>
              .
            </p>
          )}
          {read.kind === 'loaded' &&
            read.releases.map((release, index) => (
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
