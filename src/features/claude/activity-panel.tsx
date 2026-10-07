import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as tauri from '../../lib/tauri';
import { cn } from '../../lib/cn';
import { useRepoPath } from '../../hooks/use-repo';
import { useCurrentViewRef } from '../../hooks/use-current-view';
import { goToThread } from '../../lib/thread-location';
import { MarkdownContent } from '../../components/layout/markdown-content';
import { Spinner } from '../../components/icons/spinner';
import { buttonClaudeSolid, buttonIcon, buttonOutline } from '../../components/ui/button-styles';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  CodeIcon,
  CommentIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PencilIcon,
  SearchIcon,
  SparkleIcon,
  StopIcon,
  TerminalIcon,
  XIcon,
} from '../../components/ui/icon';
import type { Chat } from '../../lib/types';
import { agentMeta } from './agents';
import { runModelLabel, useModelCatalog } from './model-setting';
import { openRunResult } from './claude-runner';
import {
  closeActivity,
  currentFile,
  filesRead,
  finalText,
  logFromMessages,
  modelFromMessages,
  openActivity,
  toolCount,
  useRunActivity,
  type ActivityItem,
  type ActivityLog,
  type RunActivity,
} from './run-activity';

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

type ToolItem = Extract<ActivityItem, { kind: 'tool' }>;
type CommentItem = Extract<ActivityItem, { kind: 'comment' }>;

function isRunning(tool: ToolItem) {
  return tool.status === 'pending' || tool.status === 'in_progress';
}

function ToolGlyph(props: { tool: ToolItem }) {
  const { tool } = props;
  if (isRunning(tool)) {
    return <Spinner className="text-claude" />;
  }
  if (tool.status === 'failed') {
    return <AlertCircleIcon size="sm" className="text-deleted" />;
  }
  const className = 'text-text-muted';
  switch (tool.toolKind) {
    case 'read':
      return <FileTextIcon size="sm" className={className} />;
    case 'search':
      return <SearchIcon size="sm" className={className} />;
    case 'execute':
      return <TerminalIcon size="sm" className={className} />;
    case 'edit':
    case 'delete':
    case 'move':
      return <PencilIcon size="sm" className={className} />;
    case 'fetch':
      return <ExternalLinkIcon size="sm" className={className} />;
    default:
      return <CodeIcon size="sm" className={className} />;
  }
}

function toolTitle(tool: ToolItem, repoPath: string): string {
  const root = repoPath.endsWith('/') ? repoPath : `${repoPath}/`;
  return tool.title.split(root).join('');
}

function commentLabel(comment: CommentItem) {
  const name = comment.filePath.split('/').pop() ?? comment.filePath;
  return `${name}:${comment.line}`;
}

function firstLine(text: string) {
  return text.trim().split('\n')[0] ?? '';
}

function ThoughtRow(props: { item: Extract<ActivityItem, { kind: 'thought' }>; live: boolean; now: number }) {
  const { item, live, now } = props;
  const [open, setOpen] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (live && textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [live, item.text]);

  if (live) {
    return (
      <div className="flex flex-col gap-1 px-3 py-2.5 rounded-lg bg-claude/6 border border-claude/25">
        <div className="flex items-center gap-1.5 text-claude">
          <span className="font-medium">Thinking…</span>
          <span className="ml-auto text-text-muted tabular-nums">{item.startedAt ? formatElapsed(now - item.startedAt) : null}</span>
        </div>
        <div ref={textRef} className="max-h-48 overflow-y-auto whitespace-pre-wrap italic leading-[18px] text-text-secondary">
          {item.text.trim()}
        </div>
      </div>
    );
  }

  const seconds = item.startedAt && item.endedAt ? Math.max(1, Math.round((item.endedAt - item.startedAt) / 1000)) : null;
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-text-muted hover:text-text cursor-pointer text-left" aria-expanded={open}>
        <ChevronRightIcon size="xs" className={cn('transition-transform', open && 'rotate-90')} />
        <span className="font-medium">{seconds ? `Thought for ${seconds}s` : 'Thought'}</span>
      </button>
      {open ? (
        <div className="pl-4 whitespace-pre-wrap italic leading-[18px] text-text-secondary">{item.text.trim()}</div>
      ) : (
        <div className="pl-4 truncate italic text-text-muted">{firstLine(item.text)}</div>
      )}
    </div>
  );
}

function TimelineItem(props: { item: ActivityItem; live: boolean; startedAt: number; now: number; repoPath: string; ref: string | null }) {
  const { item, live, startedAt, now, repoPath, ref } = props;
  switch (item.kind) {
    case 'thought':
      return <ThoughtRow item={item} live={live} now={now} />;
    case 'text':
      return (
        <div className="text-[13px] leading-5 text-text">
          <MarkdownContent content={item.text} />
        </div>
      );
    case 'tool':
      return (
        <div className={cn('flex items-start gap-2', isRunning(item) ? 'text-text' : 'text-text-secondary')}>
          <span className="flex items-center h-4 shrink-0">
            <ToolGlyph tool={item} />
          </span>
          <span className="flex-1 min-w-0 break-words font-mono text-[11.5px] leading-4">{toolTitle(item, repoPath)}</span>
          {item.at && <span className="shrink-0 text-text-muted tabular-nums">{formatElapsed(item.at - startedAt)}</span>}
        </div>
      );
    case 'comment':
      return (
        <div className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-diff-comment-gutter bg-diff-comment-bg">
          <div className="flex items-center gap-1.5 font-medium">
            <CommentIcon size="sm" className="text-modified" />
            Left a comment
            {ref && (
              <button type="button" onClick={() => goToThread(repoPath, { ref, threadId: item.id })} className="ml-auto font-mono text-[11px] font-normal text-accent hover:underline cursor-pointer">
                {commentLabel(item)}
              </button>
            )}
          </div>
          <div className="line-clamp-3 leading-[17px] text-text-secondary">{item.body}</div>
        </div>
      );
  }
}

function PlanCard(props: { plan: ActivityLog['plan'] }) {
  const { plan } = props;
  const done = plan.filter((entry) => entry.status === 'completed').length;

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-border bg-bg-secondary">
      <div className="flex items-center justify-between font-medium text-text-secondary">
        Plan
        <span className="font-normal text-text-muted">{done} of {plan.length}</span>
      </div>
      {plan.map((entry, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="flex items-center h-4 shrink-0">
            {entry.status === 'completed' && <CheckIcon size="sm" className="text-added" />}
            {entry.status === 'in_progress' && <Spinner className="text-claude" />}
            {entry.status !== 'completed' && entry.status !== 'in_progress' && <span className="w-3 h-3 rounded-full border-[1.5px] border-control-border" />}
          </span>
          <span className={cn('leading-4', entry.status === 'completed' && 'text-text-muted line-through', entry.status === 'in_progress' && 'font-medium')}>{entry.content}</span>
        </div>
      ))}
    </div>
  );
}

interface ShownRun {
  key: string;
  activity: Pick<RunActivity, 'items' | 'plan' | 'agentId' | 'model' | 'actionKind' | 'startedAt' | 'endedAt' | 'outcome' | 'ref'>;
  /** Comments are only tracked for runs this window watched. */
  live: RunActivity | null;
}

function chatLabel(chat: Chat) {
  const when = new Date(chat.createdAt);
  const time = when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${time} · ${agentMeta(chat.agentId).short}`;
}

function actionTitle(kind: string) {
  if (kind === 'review') {
    return 'Review activity';
  }
  return kind === 'guide' ? 'Guide activity' : 'Agent activity';
}

function outcomeTitle(activity: ShownRun['activity'], name: string) {
  const took = activity.endedAt ? ` in ${formatElapsed(activity.endedAt - activity.startedAt)}` : '';
  if (activity.outcome === 'failed') {
    return `${name} stopped with an error${took}`;
  }
  if (activity.outcome === 'stopped') {
    return `${name} was stopped${took}`;
  }
  if (activity.actionKind === 'review') {
    return `Review finished${took}`;
  }
  return activity.actionKind === 'guide' ? `Guide written${took}` : `${name} finished${took}`;
}

function toMarkdown(activity: ShownRun['activity'], repoPath: string) {
  const lines: string[] = [];
  for (const item of activity.items) {
    if (item.kind === 'thought') {
      lines.push(item.text.trim().split('\n').map((line) => `> ${line}`).join('\n'));
    } else if (item.kind === 'text') {
      lines.push(item.text.trim());
    } else if (item.kind === 'tool') {
      lines.push(`- \`${toolTitle(item, repoPath)}\``);
    } else {
      lines.push(`- Comment on \`${item.filePath}:${item.line}\`: ${item.body}`);
    }
  }
  return lines.join('\n\n');
}

function useShownRun(repoPath: string, selected: string | null): { shown: ShownRun | null; chats: Chat[] } {
  const live = useRunActivity((state) => state.byRepo[repoPath] ?? null);
  const viewRef = useCurrentViewRef();
  const ref = live?.ref ?? viewRef;
  const queryClient = useQueryClient();
  const { data: chats = [] } = useQuery({
    queryKey: ['chats', repoPath, ref],
    queryFn: () => tauri.listChats(repoPath, ref ?? undefined),
    enabled: !!ref,
  });

  const outcome = live?.outcome;
  useEffect(() => {
    if (outcome && outcome !== 'running') {
      void queryClient.invalidateQueries({ queryKey: ['chats', repoPath] });
    }
  }, [outcome, repoPath, queryClient]);

  const key = selected ?? live?.chatId ?? chats[0]?.id ?? null;
  const fromLive = !!live && (key === null || key === live.chatId);
  const chat = fromLive ? null : chats.find((item) => item.id === key) ?? null;
  const { data: messages } = useQuery({
    queryKey: ['chat-messages', chat?.id],
    queryFn: () => tauri.getChatMessages(chat!.id),
    enabled: !!chat,
  });
  const saved = useMemo(() => (messages ? { ...logFromMessages(messages), model: modelFromMessages(messages) } : null), [messages]);

  if (fromLive && live) {
    return { shown: { key: live.chatId ?? live.runId, activity: live, live }, chats };
  }
  if (chat && saved) {
    return {
      shown: {
        key: chat.id,
        activity: {
          ...saved,
          agentId: chat.agentId,
          actionKind: chat.mode === 'review' ? 'review' : 'other',
          startedAt: Date.parse(chat.createdAt),
          endedAt: Date.parse(chat.updatedAt),
          outcome: 'done',
          ref,
        },
        live: null,
      },
      chats,
    };
  }
  return { shown: null, chats };
}

/** Docked beside the page: what the agent is doing (or did) for the run in this project. */
export function ActivityPanel() {
  const open = useRunActivity((state) => state.open);
  if (!open) {
    return null;
  }
  return <ActivityPanelBody />;
}

function ActivityPanelBody() {
  const repoPath = useRepoPath();
  const [selected, setSelected] = useState<string | null>(null);
  const { shown, chats } = useShownRun(repoPath, selected);
  const running = shown?.activity.outcome === 'running';
  const now = useNow(running);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const items = shown?.activity.items;

  useLayoutEffect(() => {
    if (running && follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items, running, follow]);

  const liveKey = useRunActivity((state) => state.byRepo[repoPath]?.chatId ?? null);
  const options = useMemo(() => {
    const list = chats.map((chat) => ({ id: chat.id, label: chatLabel(chat) }));
    if (liveKey && !list.some((item) => item.id === liveKey)) {
      list.unshift({ id: liveKey, label: 'Current run' });
    }
    return list;
  }, [chats, liveKey]);

  const title = actionTitle(shown?.activity.actionKind ?? 'review');

  return (
    <aside className="flex flex-col w-[400px] max-w-[45vw] shrink-0 h-screen bg-bg border-l border-frame-border font-sans text-xs text-text animate-slide-in-right" aria-label={title}>
      <div data-tauri-drag-region className="flex items-center gap-2 h-11 shrink-0 pl-3.5 pr-2 border-b border-border">
        <SparkleIcon size="md" className="text-claude" />
        <span className="text-[13px] font-semibold">{title}</span>
        {options.length > 1 && shown && (
          <select
            aria-label="Run"
            value={shown.key}
            onChange={(event) => setSelected(event.target.value)}
            className="ml-auto max-w-[180px] h-6 px-1.5 rounded-md border border-control-border bg-raised text-xs text-text"
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={closeActivity} className={cn(buttonIcon, options.length > 1 && shown ? '' : 'ml-auto')} aria-label="Close activity" title="Close">
          <XIcon size="sm" />
        </button>
      </div>

      {shown && <RunModelLine agentId={shown.activity.agentId} model={shown.activity.model} />}
      {!shown ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center text-[13px] leading-5 text-text-muted">
          Ask an agent to review and you can follow what it reads and thinks here.
        </div>
      ) : (
        <>
          {!running && <Summary shown={shown} repoPath={repoPath} />}
          <div
            ref={scrollRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
            }}
            className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-3.5"
          >
            {running && shown.activity.plan.length > 0 && <PlanCard plan={shown.activity.plan} />}
            {shown.activity.items.length === 0 && running && (
              <div className="flex items-center gap-2 text-text-muted">
                <Spinner className="text-claude" />
                Starting…
              </div>
            )}
            {shown.activity.items.map((item, index) => (
              <TimelineItem
                key={`${item.kind}-${item.id}`}
                item={item}
                live={running && index === shown.activity.items.length - 1}
                startedAt={shown.activity.startedAt}
                now={now}
                repoPath={repoPath}
                ref={shown.activity.ref}
              />
            ))}
          </div>
          {running && (
            <div className="flex items-center gap-2 h-10 shrink-0 px-3.5 border-t border-border text-text-secondary">
              {follow ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-added" />
                  Following live
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setFollow(true)}
                  className="text-accent hover:underline cursor-pointer"
                >
                  Jump to latest
                </button>
              )}
              <span className="ml-auto text-text-muted">
                {toolCount(shown.activity)} steps · {shown.activity.items.filter((item) => item.kind === 'comment').length} comments
              </span>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function RunModelLine(props: { agentId: string; model: RunActivity['model'] }) {
  const { agentId, model } = props;
  const { data: catalog } = useModelCatalog(agentId);
  const name = agentMeta(agentId).name;

  return (
    <div className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 border-b border-border-muted text-text-muted">
      <span className="text-text-secondary">{name}</span>
      {model && (
        <>
          <span aria-hidden>·</span>
          <span className="truncate">{runModelLabel(catalog, model, 'Default model')}</span>
        </>
      )}
    </div>
  );
}

function Stat(props: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg bg-bg-secondary">
      <span className="text-lg font-semibold tabular-nums">{props.value}</span>
      <span className="text-[11px] text-text-muted">{props.label}</span>
    </div>
  );
}

function Summary(props: { shown: ShownRun; repoPath: string }) {
  const { shown, repoPath } = props;
  const { activity, live } = shown;
  const name = agentMeta(activity.agentId).short;
  const comments = live ? live.items.filter((item): item is CommentItem => item.kind === 'comment') : null;
  const wrapUp = finalText(activity);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3 shrink-0 max-h-[45%] overflow-y-auto px-3.5 py-3.5 border-b border-border">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        {activity.outcome === 'done' && <CheckIcon size="sm" className="text-added" />}
        {activity.outcome === 'stopped' && <StopIcon size="xs" className="text-text-muted" />}
        {activity.outcome === 'failed' && <AlertCircleIcon size="sm" className="text-deleted" />}
        {outcomeTitle(activity, name)}
      </div>
      <div className={cn('grid gap-2', comments ? 'grid-cols-3' : 'grid-cols-2')}>
        {comments && <Stat value={comments.length} label={comments.length === 1 ? 'comment' : 'comments'} />}
        <Stat value={filesRead(activity, repoPath).length} label="files read" />
        <Stat value={toolCount(activity)} label="tool calls" />
      </div>
      {wrapUp && (
        <div className="text-[13px] leading-5 text-text-secondary">
          <MarkdownContent content={wrapUp} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonOutline}
          onClick={() => {
            void navigator.clipboard.writeText(toMarkdown(activity, repoPath)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }).catch(() => undefined);
          }}
        >
          {copied ? 'Copied' : 'Copy as Markdown'}
        </button>
        {comments && comments.length > 0 && (
          <button type="button" className={cn(buttonClaudeSolid, 'ml-auto')} onClick={() => openRunResult(repoPath, activity.ref, comments.map((item) => item.id))}>
            Show {comments.length} comment{comments.length === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Hover card on the status pill: model, progress, the latest step and the comments so far. */
export function ActivityPeek(props: { onOpen: () => void }) {
  const { onOpen } = props;
  const repoPath = useRepoPath();
  const activity = useRunActivity((state) => state.byRepo[repoPath] ?? null);
  const { data: catalog } = useModelCatalog(activity?.agentId ?? 'claude');
  if (!activity) {
    return null;
  }
  const comments = activity.items.filter((item): item is CommentItem => item.kind === 'comment');
  const done = activity.plan.filter((entry) => entry.status === 'completed').length;
  const step = activity.plan.find((entry) => entry.status === 'in_progress');
  const last = activity.items[activity.items.length - 1];
  const lastTool = [...activity.items].reverse().find((item): item is ToolItem => item.kind === 'tool');
  const thought = last?.kind === 'thought' ? last.text.trim() : null;

  return (
    <div className="flex flex-col text-xs">
      <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{activity.model ? runModelLabel(catalog, activity.model) : agentMeta(activity.agentId).short}</span>
          <span className="ml-auto text-text-secondary">{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
        </div>
        {activity.plan.length > 0 && (
          <>
            <div className="text-text-secondary truncate">
              Step {Math.min(done + 1, activity.plan.length)} of {activity.plan.length}{step ? `: ${step.content}` : ''}
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${activity.plan.length}, minmax(0, 1fr))` }}>
              {activity.plan.map((entry, index) => (
                <span key={index} className={cn('h-1 rounded-full', entry.status === 'completed' ? 'bg-added' : entry.status === 'in_progress' ? 'bg-claude' : 'bg-fill')} />
              ))}
            </div>
          </>
        )}
      </div>
      {(thought || lastTool) && (
        <div className="flex flex-col gap-1.5 px-3.5 py-3 border-t border-border-muted bg-bg-secondary">
          <div className="text-[11px] font-medium text-text-muted">Now</div>
          {thought && <div className="line-clamp-3 italic leading-[18px] text-text-secondary">{thought.length > 220 ? `…${thought.slice(-220)}` : thought}</div>}
          {lastTool && (
            <div className="flex items-center gap-2 min-w-0">
              <ToolGlyph tool={lastTool} />
              <span className="truncate font-mono text-[11.5px]">{toolTitle(lastTool, repoPath)}</span>
            </div>
          )}
        </div>
      )}
      {comments.length > 0 && (
        <div className="flex flex-col gap-1.5 px-3.5 py-3 border-t border-border-muted">
          <div className="text-[11px] font-medium text-text-muted">Comments so far</div>
          {comments.slice(-4).map((comment) => (
            <div key={comment.id} className="flex items-center gap-2 min-w-0">
              {activity.ref && (
                <button type="button" onClick={() => goToThread(repoPath, { ref: activity.ref!, threadId: comment.id })} className="shrink-0 font-mono text-[11px] text-accent hover:underline cursor-pointer">
                  {commentLabel(comment)}
                </button>
              )}
              <span className="truncate text-text-secondary">{firstLine(comment.body)}</span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          openActivity();
          onOpen();
        }}
        className="flex items-center h-9 px-3.5 border-t border-border-muted font-medium text-left hover:bg-hover cursor-pointer"
      >
        Open activity panel
      </button>
    </div>
  );
}

/** Marks the file the agent is reading right now in the file list. */
export function AgentReadingDot(props: { path: string }) {
  const { path } = props;
  const repoPath = useRepoPath();
  const reading = useRunActivity((state) => {
    const activity = state.byRepo[repoPath];
    return !!activity && activity.outcome === 'running' && currentFile(activity, repoPath) === path;
  });
  if (!reading) {
    return null;
  }
  const name = agentMeta(useRunActivity.getState().byRepo[repoPath]?.agentId ?? 'claude').short;
  return <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-claude animate-pulse" title={`${name} is reading this file`} aria-label={`${name} is reading this file`} />;
}

