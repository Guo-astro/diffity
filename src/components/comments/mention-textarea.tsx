import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { splitMentions } from '../../lib/mentions';
import { SparkleIcon } from '../ui/icon';
import { AGENTS, useInstalledAgents, type AgentMeta } from '../../features/claude/agents';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

interface MentionQuery {
  start: number;
  end: number;
  typed: string;
}

const BACKDROP_RESET = 'absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none select-none text-transparent resize-none placeholder:text-transparent';

function MentionBackdrop(props: { value: string; className?: string; backdropRef: React.RefObject<HTMLDivElement | null> }) {
  const { value, className, backdropRef } = props;

  return (
    <div ref={backdropRef} aria-hidden className={cn(className, BACKDROP_RESET)}>
      {splitMentions(value).map((part, index) => {
        if (!part.mention) {
          return <span key={index}>{part.text}</span>;
        }
        return (
          <mark key={index} className="rounded bg-claude/15 text-transparent ring-1 ring-claude/30">
            {part.text}
          </mark>
        );
      })}
      {'\n'}
    </div>
  );
}

function findMentionQuery(value: string, caret: number): MentionQuery | null {
  const before = value.slice(0, caret);
  const match = /(^|[\s(])@([\w-]*)$/.exec(before);
  if (!match) {
    return null;
  }
  const typed = match[2].toLowerCase();
  return { start: caret - typed.length - 1, end: caret, typed };
}

function suggestionsFor(query: MentionQuery | null, agents: AgentMeta[]): AgentMeta[] {
  if (!query) {
    return [];
  }
  return agents.filter((agent) => agent.handle.startsWith(query.typed) && agent.handle !== query.typed);
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(function MentionTextarea(props, ref) {
  const { value, onChange, onKeyDown, placeholder, rows, className } = props;
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  const installed = useInstalledAgents();
  const suggestions = suggestionsFor(query, installed.length > 0 ? installed : AGENTS);
  const selected = suggestions[Math.min(active, suggestions.length - 1)] ?? null;

  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const refreshQuery = (next: string, caret: number) => {
    setQuery(findMentionQuery(next, caret));
    setActive(0);
  };

  const accept = (agent: AgentMeta | null) => {
    if (!query || !agent) {
      return;
    }
    const insert = `@${agent.handle} `;
    const next = value.slice(0, query.start) + insert + value.slice(query.end);
    onChange(next);
    setQuery(null);
    const caret = query.start + insert.length;
    requestAnimationFrame(() => {
      const el = innerRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (selected && (e.key === 'Enter' || e.key === 'Tab') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      accept(selected);
      return;
    }
    if (suggestions.length > 1 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
      return;
    }
    if (selected && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
      return;
    }
    onKeyDown?.(e);
  };

  const syncScroll = () => {
    const el = innerRef.current;
    const backdrop = backdropRef.current;
    if (!el || !backdrop) {
      return;
    }
    backdrop.scrollTop = el.scrollTop;
  };

  return (
    <div className="relative">
      <MentionBackdrop value={value} className={className} backdropRef={backdropRef} />
      <textarea
        ref={innerRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          refreshQuery(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => refreshQuery(value, e.currentTarget.selectionStart)}
        onBlur={() => setQuery(null)}
        onScroll={syncScroll}
        placeholder={placeholder}
        rows={rows}
        className={cn(className, 'relative bg-transparent')}
      />
      {suggestions.length > 0 && (
        <div className="absolute left-2 top-full -mt-1 z-30 w-60 py-1 bg-overlay rounded-lg ring-1 ring-overlay-border">
          {suggestions.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                accept(agent);
              }}
              onMouseEnter={() => setActive(suggestions.indexOf(agent))}
              className={cn('flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-text cursor-pointer text-left', agent === selected && 'bg-hover')}
            >
              <SparkleIcon className="w-3.5 h-3.5 text-claude" />
              <span className="font-semibold">@{agent.handle}</span>
              <span className="text-text-muted truncate">Ask {agent.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
