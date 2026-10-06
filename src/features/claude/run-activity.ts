import { create } from 'zustand';
import type { AgentEvent, ChatMessage, PlanEntry, RunModel } from '../../lib/types';

export type ActivityItem =
  | { kind: 'thought'; id: string; text: string; startedAt: number | null; endedAt: number | null }
  | { kind: 'text'; id: string; messageId: string; text: string }
  | { kind: 'tool'; id: string; title: string; toolKind: string; status: string; locations: string[]; at: number | null }
  | { kind: 'comment'; id: string; filePath: string; line: number; body: string; at: number };

export interface ActivityLog {
  items: ActivityItem[];
  plan: PlanEntry[];
}

export type RunOutcome = 'running' | 'done' | 'stopped' | 'failed';

/** What an agent run did, kept per project after the run ends so the panel can still show it. */
export interface RunActivity extends ActivityLog {
  runId: string;
  chatId: string | null;
  repoPath: string;
  ref: string | null;
  agentId: string;
  model: RunModel | null;
  actionKind: string;
  startedAt: number;
  endedAt: number | null;
  outcome: RunOutcome;
}

interface ActivityState {
  byRepo: Record<string, RunActivity>;
  open: boolean;
}

export const useRunActivity = create<ActivityState>(() => ({ byRepo: {}, open: false }));

export function openActivity() {
  useRunActivity.setState({ open: true });
}

export function closeActivity() {
  useRunActivity.setState({ open: false });
}

export function toggleActivity() {
  useRunActivity.setState((state) => ({ open: !state.open }));
}

/** Folds events into the log: streamed thought and text chunks join the item before them, tool updates patch their call. */
export function applyEvents(log: ActivityLog, events: AgentEvent[], at: number | null): ActivityLog {
  if (events.length === 0) {
    return log;
  }
  const items = [...log.items];
  let plan = log.plan;
  const closeThought = () => {
    const last = items[items.length - 1];
    if (last?.kind === 'thought' && last.endedAt === null && at !== null) {
      items[items.length - 1] = { ...last, endedAt: at };
    }
  };
  for (const event of events) {
    const last = items[items.length - 1];
    switch (event.type) {
      case 'thought':
        if (last?.kind === 'thought') {
          items[items.length - 1] = { ...last, text: last.text + event.delta };
        } else {
          items.push({ kind: 'thought', id: `thought-${items.length}`, text: event.delta, startedAt: at, endedAt: null });
        }
        break;
      case 'text':
        if (last?.kind === 'text' && last.messageId === event.messageId) {
          items[items.length - 1] = { ...last, text: last.text + event.delta };
        } else {
          closeThought();
          items.push({ kind: 'text', id: `text-${items.length}`, messageId: event.messageId, text: event.delta });
        }
        break;
      case 'toolCall': {
        closeThought();
        const index = findTool(items, event.id);
        const item = { kind: 'tool' as const, id: event.id, title: event.title, toolKind: event.kind, status: event.status, locations: event.locations, at };
        if (index === -1) {
          items.push(item);
        } else {
          items[index] = { ...item, at: (items[index] as Extract<ActivityItem, { kind: 'tool' }>).at };
        }
        break;
      }
      case 'toolCallUpdate': {
        const index = findTool(items, event.id);
        if (index !== -1) {
          const tool = items[index] as Extract<ActivityItem, { kind: 'tool' }>;
          items[index] = { ...tool, status: event.status, title: event.title ?? tool.title };
        }
        break;
      }
      case 'plan':
        plan = event.entries;
        break;
      case 'done':
      case 'error':
        closeThought();
        break;
    }
  }
  return { items, plan };
}

function findTool(items: ActivityItem[], id: string): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === 'tool' && item.id === id) {
      return index;
    }
  }
  return -1;
}

/** A saved chat's agent turns as one log; saved events carry no times. */
export function logFromMessages(messages: ChatMessage[]): ActivityLog {
  let log: ActivityLog = { items: [], plan: [] };
  for (const message of messages) {
    if (message.role === 'agent' && Array.isArray(message.content)) {
      log = applyEvents(log, message.content, null);
    }
  }
  return log;
}

/** The model of the chat's latest turn that recorded one. */
export function modelFromMessages(messages: ChatMessage[]): RunModel | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index].content;
    if (messages[index].role === 'user' && !Array.isArray(content) && content.model) {
      return content.model;
    }
  }
  return null;
}

export function relativePath(repoPath: string, path: string): string {
  const root = repoPath.endsWith('/') ? repoPath : `${repoPath}/`;
  return path.startsWith(root) ? path.slice(root.length) : path;
}

/** Repo files the agent read, in the order it first opened them. */
export function filesRead(log: ActivityLog, repoPath: string): string[] {
  const seen = new Set<string>();
  for (const item of log.items) {
    if (item.kind === 'tool' && item.toolKind === 'read') {
      for (const location of item.locations) {
        seen.add(relativePath(repoPath, location));
      }
    }
  }
  return [...seen];
}

export function toolCount(log: ActivityLog): number {
  return log.items.filter((item) => item.kind === 'tool').length;
}

/** The file a still-running tool call is on, if any. */
export function currentFile(log: ActivityLog, repoPath: string): string | null {
  for (let index = log.items.length - 1; index >= 0; index -= 1) {
    const item = log.items[index];
    if (item.kind === 'tool') {
      const running = item.status === 'pending' || item.status === 'in_progress';
      return running && item.locations[0] ? relativePath(repoPath, item.locations[0]) : null;
    }
  }
  return null;
}

/** The agent's last message, which for a review is its wrap-up. */
export function finalText(log: ActivityLog): string | null {
  for (let index = log.items.length - 1; index >= 0; index -= 1) {
    const item = log.items[index];
    if (item.kind === 'text') {
      return item.text.trim() || null;
    }
  }
  return null;
}

function patch(repoPath: string, runId: string, change: (activity: RunActivity) => RunActivity) {
  useRunActivity.setState((state) => {
    const activity = state.byRepo[repoPath];
    if (!activity || activity.runId !== runId) {
      return state;
    }
    return { byRepo: { ...state.byRepo, [repoPath]: change(activity) } };
  });
}

const buffers = new Map<string, { repoPath: string; events: AgentEvent[] }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Applies buffered events; thought chunks arrive many times a second, so the store changes at most every 100ms. */
export function flushActivity() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const now = Date.now();
  for (const [runId, buffer] of buffers) {
    patch(buffer.repoPath, runId, (activity) => ({ ...activity, ...applyEvents(activity, buffer.events, now) }));
  }
  buffers.clear();
}

export function startActivity(activity: Omit<RunActivity, 'items' | 'plan' | 'endedAt' | 'outcome'>) {
  useRunActivity.setState((state) => ({
    byRepo: { ...state.byRepo, [activity.repoPath]: { ...activity, items: [], plan: [], endedAt: null, outcome: 'running' } },
  }));
}

export function recordEvent(repoPath: string, runId: string, event: AgentEvent) {
  const buffer = buffers.get(runId) ?? { repoPath, events: [] };
  buffer.events.push(event);
  buffers.set(runId, buffer);
  flushTimer ??= setTimeout(flushActivity, 100);
}

export function recordComments(repoPath: string, runId: string, comments: Extract<ActivityItem, { kind: 'comment' }>[]) {
  flushActivity();
  patch(repoPath, runId, (activity) => {
    const known = new Set(activity.items.filter((item) => item.kind === 'comment').map((item) => item.id));
    const fresh = comments.filter((comment) => !known.has(comment.id));
    return fresh.length > 0 ? { ...activity, items: [...activity.items, ...fresh] } : activity;
  });
}

export function finishActivity(repoPath: string, runId: string, outcome: Exclude<RunOutcome, 'running'>) {
  flushActivity();
  const now = Date.now();
  patch(repoPath, runId, (activity) => ({ ...activity, ...applyEvents(activity, [{ type: 'done', stopReason: outcome }], now), endedAt: now, outcome }));
}
