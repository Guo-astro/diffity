import { useEffect, useRef, useState } from 'react';
import { XIcon } from './ui/icon';
import { useThemeStore } from '../hooks/use-theme';

type Mermaid = typeof import('mermaid').default;

let mermaidPromise: Promise<Mermaid> | null = null;

/** Mermaid is large, so it loads the first time a diagram is shown, not with the app (issue #55). */
function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => module.default);
  }
  return mermaidPromise;
}

let initializedTheme: 'light' | 'dark' | null = null;

function initMermaid(mermaid: Mermaid, theme: 'light' | 'dark') {
  if (initializedTheme === theme) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    flowchart: { padding: 8 },
    securityLevel: 'strict',
  });
  initializedTheme = theme;
}

let idCounter = 0;
let renderCounter = 0;

/** `frameClassName` sizes the inline preview (200px tall unless set); the full diagram opens in a dialog. */
export function MermaidDiagram(props: { chart: string; frameClassName?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${idCounter++}`);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;

    loadMermaid()
      .then((mermaid) => {
        if (cancelled) {
          return null;
        }
        initMermaid(mermaid, theme);
        // A fresh id per render: reusing one while an earlier render of it is still running leaves an empty diagram.
        return mermaid.render(`${idRef.current}-${++renderCounter}`, props.chart);
      })
      .then((result) => {
        if (cancelled || !result) {
          return;
        }
        container.innerHTML = result.svg;
        setSvgContent(result.svg);
        setError(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Failed to render diagram');
      });

    return () => {
      cancelled = true;
    };
  }, [props.chart, theme]);

  if (error) {
    return (
      <pre className="my-2 p-2 bg-bg-tertiary rounded text-[10px] font-mono overflow-x-auto text-text-muted">
        {props.chart}
      </pre>
    );
  }

  return (
    <>
      <div className="my-3 relative group">
        <div
          ref={containerRef}
          className={`flex justify-center overflow-hidden [&_svg]:max-w-full ${props.frameClassName ?? 'max-h-[200px]'}`}
        />
        {svgContent && (
          <button
            onClick={() => {
              // Focus the dialog, not its close button, so the button does not open with a focus ring.
              dialogRef.current?.showModal();
              dialogRef.current?.focus();
            }}
            className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-bg/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <span className="mb-3 px-3 py-1.5 text-xs font-medium rounded-md bg-bg border border-border text-text">
              View full diagram
            </span>
          </button>
        )}
      </div>

      <dialog
        ref={dialogRef}
        tabIndex={-1}
        className="outline-none bg-overlay text-text ring-1 ring-overlay-border rounded-xl w-[90vw] max-h-[90vh] overflow-auto backdrop:bg-black/60 backdrop:backdrop-blur-sm p-0 m-auto fixed inset-0 h-fit"
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-overlay-border">
          <h2 className="text-sm font-semibold">Diagram</h2>
          <button
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-hover cursor-pointer"
            onClick={() => dialogRef.current?.close()}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 flex justify-center [&_svg]:!w-full [&_svg]:h-auto [&_svg]:block [&_svg]:mx-auto">
          {svgContent && (
            <div
              className="w-full"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
