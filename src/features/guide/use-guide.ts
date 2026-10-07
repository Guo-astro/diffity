import { useQuery } from '@tanstack/react-query';
import * as tauri from '../../lib/tauri';
import { queryClient } from '../../lib/query-client';
import { enqueueClaude, useClaude, type ClaudeRun } from '../claude/claude-runner';
import type { RunPick } from '../claude/model-setting';

/** `overview`, or the `key` of a chapter. */
export type GuideStep = string;

export const OVERVIEW_STEP: GuideStep = 'overview';

export function useGuide(sessionId: string | null) {
  return useQuery({
    queryKey: ['guide', sessionId],
    queryFn: () => tauri.getGuide(sessionId!),
    enabled: !!sessionId,
  });
}

/** The pull request a view shows, whose title and description tell the agent what the change is for. */
export interface GuidePullRequest {
  title: string;
  body: string;
}

export function startGuide(repoPath: string, ref: string, sessionId: string | null, pick: RunPick, pr?: GuidePullRequest | null) {
  enqueueClaude({ kind: 'guide', ref, title: pr?.title, description: pr?.body || undefined }, { repoPath, sessionId, pick });
}

export async function deleteGuide(sessionId: string) {
  await tauri.deleteGuide(sessionId);
  await queryClient.invalidateQueries({ queryKey: ['guide', sessionId] });
}

/** The run writing (or queued to write) a guide for this view. */
export function useGuideRun(repoPath: string, ref: string): ClaudeRun | null {
  return useClaude((state) => state.runs.find((run) => run.action.kind === 'guide' && run.action.ref === ref && run.context.repoPath === repoPath) ?? null);
}
