import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '../../lib/api';
import { DEFAULT_AUTHOR, SEVERITY_LABELS, type CommentThread } from '../../components/comments/types';
import { buttonGhost, buttonPrimary } from '../../components/ui/button-styles';
import { Spinner } from '../../components/icons/spinner';
import { modKey } from '../../lib/platform';

interface PromoteFormProps {
  thread: CommentThread;
  sessionId: string;
  prNumber: number;
  agentName: string;
  onClose: () => void;
}

/**
 * Turns an agent's comment into a draft of your GitHub review: its text is yours to edit first (the conversation
 * above stays for reference). The agent's comment is resolved once the review is posted, not before.
 */
export function PromoteForm(props: PromoteFormProps) {
  const { thread, sessionId, prNumber, agentName, onClose } = props;
  const queryClient = useQueryClient();
  const [body, setBody] = useState(thread.comments[0]?.body ?? '');
  const [prefix, setPrefix] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const severity = thread.severity ? SEVERITY_LABELS[thread.severity] ?? thread.severity : null;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [body]);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || saving) {
      return;
    }
    setSaving(true);
    try {
      await api.createThread({
        sessionId,
        filePath: thread.filePath,
        side: thread.side,
        startLine: thread.startLine,
        endLine: thread.endLine,
        body: prefix && severity ? `**${severity}:** ${trimmed}` : trimmed,
        author: DEFAULT_AUTHOR,
        anchorContent: thread.anchorContent,
        options: { pending: true },
        viewRef: thread.viewRef,
        promotedFrom: thread.id,
      });
      toast.success(`Added to your review on PR #${prNumber}`, { description: `Posted when you submit the review. ${agentName}'s comment is resolved then.` });
      onClose();
    } catch (error) {
      toast.error('Could not add it to your review', { description: api.errorMessage(error) });
    } finally {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ['threads', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['repo-threads'] });
    }
  };

  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-border bg-bg transition-colors focus-within:border-focus">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          rows={2}
          className="block w-full max-h-80 px-3 pt-2.5 pb-1.5 text-[13px] leading-5 bg-transparent text-text border-0 resize-none outline-none min-h-[64px] overflow-y-auto"
          aria-label="Your review comment"
        />
        <div className="flex items-center gap-2 px-3 pb-2">
          <div className="min-w-0 flex-1 flex items-center gap-3 text-xs text-text-muted" title={`${modKey}Enter adds it`}>
            {severity && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                <input type="checkbox" checked={prefix} onChange={(event) => setPrefix(event.target.checked)} className="cursor-pointer" />
                Start with “{severity}:”
              </label>
            )}
            <span className="truncate">Your words on PR #{prNumber}, posted when you submit</span>
          </div>
          <button onClick={onClose} className={buttonGhost}>
            Cancel
          </button>
          <button onClick={() => void submit()} disabled={!body.trim() || saving} className={buttonPrimary}>
            {saving ? <Spinner /> : 'Add to review'}
          </button>
        </div>
      </div>
    </div>
  );
}
