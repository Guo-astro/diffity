import { createContext, useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as tauri from '../../lib/tauri';
import { getRepoPath, updateThreadStatus } from '../../lib/api';
import { cn } from '../../lib/cn';
import { tokensToHtml } from '../../lib/syntax-token';
import { useHighlighter } from '../../hooks/use-highlighter';
import { useThemeStore } from '../../hooks/use-theme';
import type { CommentThread } from '../../components/comments/types';
import { CheckIcon } from '../../components/ui/icon';
import { Spinner } from '../../components/icons/spinner';
import { suggestionLines, suggestionState } from './suggestion';

/** Provided by views whose new side is what is on disk, so suggestions there can be applied. */
export const SuggestionTargetContext = createContext<{ canEdit: boolean }>({ canEdit: false });

interface SuggestionThread {
  thread: CommentThread;
  /** What the thread's lines read now, when the view knows it. */
  currentCode?: string;
}

export const SuggestionThreadContext = createContext<SuggestionThread | null>(null);

function useHighlightedLines(code: string, filePath: string): string[] | null {
  const { highlight } = useHighlighter();
  const theme = useThemeStore((state) => state.theme);
  const highlighted = filePath ? highlight(code, filePath, theme) : null;
  return highlighted ? highlighted.lines.map((line) => tokensToHtml(line.tokens)) : null;
}

export function SuggestionBlock(props: { code: string }) {
  const { code } = props;
  const target = useContext(SuggestionTargetContext);
  const context = useContext(SuggestionThreadContext);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const thread = context?.thread;
  const current = coversThread(context?.currentCode, thread) ? context?.currentCode : undefined;
  const original = thread?.anchorContent ?? current ?? '';
  const filePath = thread?.filePath ?? '';
  const rows = context ? suggestionLines(original, code) : suggestionLines('', code);
  const oldHtml = useHighlightedLines(original, filePath);
  const newHtml = useHighlightedLines(code, filePath);
  const state = suggestionState(code, current, thread?.anchorContent);
  const onNewSide = thread?.side === 'new';
  const canApply = target.canEdit && onNewSide && state === 'ready' && current !== undefined;

  /** Without the resolve toast: the "Suggestion applied" toast's Undo reopens it along with the file. */
  const setStatus = async (status: 'open' | 'resolved') => {
    if (!thread) {
      return;
    }
    await updateThreadStatus(thread.id, status).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ['threads'] });
  };

  const undo = async (repoPath: string, startLine: number, endLine: number, previous: string, wasOpen: boolean) => {
    if (!thread) {
      return;
    }
    try {
      await tauri.applySuggestion(repoPath, thread.filePath, startLine, endLine, code, previous);
      void queryClient.invalidateQueries({ queryKey: ['diff'] });
      if (wasOpen) {
        await setStatus('open');
      }
    } catch (error) {
      toast.error('Could not undo the suggestion', { description: tauri.errorMessage(error) });
    }
  };

  const apply = async () => {
    if (!thread || current === undefined) {
      return;
    }
    const repoPath = getRepoPath();
    setBusy(true);
    try {
      const result = await tauri.applySuggestion(repoPath, thread.filePath, thread.startLine, thread.endLine, current, code);
      void queryClient.invalidateQueries({ queryKey: ['diff'] });
      const wasOpen = thread.status === 'open';
      if (wasOpen) {
        await setStatus('resolved');
      }
      toast.success('Suggestion applied', {
        description: thread.filePath,
        duration: 8000,
        action: { label: 'Undo', onClick: () => void undo(repoPath, result.startLine, result.endLine, current, wasOpen) },
      });
    } catch (error) {
      toast.error('Could not apply the suggestion', { description: tauri.errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 h-7 px-2.5 bg-bg-secondary border-b border-border">
        <span className="text-[11px] font-medium text-text-secondary">Suggested change</span>
        <span className="flex-1" />
        {state === 'applied' && (
          <span className="inline-flex items-center gap-1 text-[11px] text-added">
            <CheckIcon className="w-3 h-3" />
            Applied
          </span>
        )}
        {state === 'outdated' && <span className="text-[11px] text-text-muted" title="These lines changed after the suggestion was made">Outdated</span>}
        {onNewSide && state === 'ready' && (
          <button
            onClick={() => void apply()}
            disabled={!canApply || busy}
            className="inline-flex items-center gap-1.5 h-5 px-2 rounded text-[11px] font-medium bg-raised border border-control-border text-text hover:bg-control-hover disabled:opacity-50 disabled:cursor-default cursor-pointer"
            title={canApply ? 'Replace these lines in your working tree' : 'Open Uncommitted changes, a branch view or a checked-out pull request to apply it'}
          >
            {busy && <Spinner className="w-3 h-3" />}
            Apply
          </button>
        )}
      </div>
      <pre className="py-1 overflow-x-auto bg-bg text-xs leading-5 font-mono">
        {rows.map((row, index) => (
          <div
            key={index}
            className={cn('flex px-2', row.kind === 'add' && 'bg-diff-add-line', row.kind === 'del' && 'bg-diff-del-line')}
          >
            <span className={cn('w-4 shrink-0 select-none', row.kind === 'add' ? 'text-added' : row.kind === 'del' ? 'text-deleted' : 'text-text-muted')}>
              {row.kind === 'add' ? '+' : row.kind === 'del' ? '-' : ' '}
            </span>
            <SuggestionLineText html={(row.kind === 'add' ? newHtml : oldHtml)?.[row.index]} text={row.text} />
          </div>
        ))}
      </pre>
    </div>
  );
}

function SuggestionLineText(props: { html: string | undefined; text: string }) {
  const { html, text } = props;

  if (html === undefined) {
    return <span>{text || ' '}</span>;
  }
  return <span dangerouslySetInnerHTML={{ __html: html || ' ' }} />;
}

/** The diff only knows the lines it shows: code that does not span the whole thread cannot be compared or applied. */
function coversThread(code: string | undefined, thread: CommentThread | undefined): boolean {
  if (code === undefined || !thread) {
    return false;
  }
  return code.split('\n').length === thread.endLine - thread.startLine + 1;
}
