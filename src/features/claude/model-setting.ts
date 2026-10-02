import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as tauri from '../../lib/tauri';
import { queryClient } from '../../lib/query-client';
import type { ModelCatalog, ModelChoice, RunModel } from '../../lib/types';

/** Reviews read the diff; fixes edit code and answer threads. Each has its own default model. */
export type ModelPurpose = 'review' | 'fix';

export const MODEL_PURPOSES: { value: ModelPurpose; label: string; hint: string }[] = [
  { value: 'review', label: 'Reviews', hint: 'Ask Claude to review' },
  { value: 'fix', label: 'Fixes and replies', hint: 'Send to Claude, Ask Claude, @claude' },
];

const CATALOG_KEY = ['agent-models'];
const STALE_MS = 24 * 60 * 60 * 1000;
const REPO_KEY = 'diffity-claude-model:';

let refreshing: Promise<ModelCatalog | null> | null = null;

function settingKey(purpose: ModelPurpose) {
  return `agent.model.${purpose}`;
}

function parseRunModel(value: string | null | undefined): RunModel {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as RunModel;
    return {
      model: typeof parsed.model === 'string' ? parsed.model : undefined,
      effort: typeof parsed.effort === 'string' ? parsed.effort : undefined,
    };
  } catch {
    return {};
  }
}

/** Asks Claude Code again for its models (a throwaway session; no tokens). */
export function refreshModelCatalog(): Promise<ModelCatalog | null> {
  if (refreshing) {
    return refreshing;
  }
  refreshing = tauri
    .agentModels(true)
    .then((catalog) => {
      queryClient.setQueryData(CATALOG_KEY, catalog);
      return catalog;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function useModelCatalog() {
  const query = useQuery({ queryKey: CATALOG_KEY, queryFn: () => tauri.agentModels(), staleTime: Infinity, retry: false });
  const fetchedAt = query.data?.fetchedAt;

  useEffect(() => {
    if (!fetchedAt || Date.now() - Date.parse(fetchedAt) < STALE_MS) {
      return;
    }
    void refreshModelCatalog().catch(() => undefined);
  }, [fetchedAt]);

  return query;
}

export function findModel(catalog: ModelCatalog | null | undefined, value: string | undefined): ModelChoice | undefined {
  if (!catalog || !value) {
    return undefined;
  }
  return catalog.models.find((model) => model.value === value);
}

/** Short label like "Opus 5.5 · High"; an unset model shows the one Claude Code uses on its own. */
export function runModelLabel(catalog: ModelCatalog | null | undefined, runModel: RunModel): string {
  const model = findModel(catalog, runModel.model) ?? findModel(catalog, catalog?.currentModel);
  const name = model?.name ?? runModel.model ?? 'Default model';
  const effort = runModel.effort ? model?.efforts.find((item) => item.value === runModel.effort)?.name ?? runModel.effort : null;
  return effort ? `${name} · ${effort}` : name;
}

/** Keeps the effort only when the newly picked model (unset: Claude Code's own) takes it. */
export function withModel(catalog: ModelCatalog | null | undefined, current: RunModel, model: string | undefined): RunModel {
  const efforts = findModel(catalog, model ?? catalog?.currentModel)?.efforts ?? [];
  const effort = current.effort && efforts.some((item) => item.value === current.effort) ? current.effort : undefined;
  return { model, effort };
}

async function loadSetting(purpose: ModelPurpose): Promise<RunModel> {
  const value = await tauri.getSetting(settingKey(purpose)).catch(() => null);
  return parseRunModel(value);
}

export function useModelSetting(purpose: ModelPurpose): RunModel {
  const { data } = useQuery({ queryKey: ['setting', settingKey(purpose)], queryFn: () => loadSetting(purpose), staleTime: Infinity });
  return data ?? {};
}

export function getModelSetting(purpose: ModelPurpose): Promise<RunModel> {
  return queryClient.fetchQuery({ queryKey: ['setting', settingKey(purpose)], queryFn: () => loadSetting(purpose), staleTime: Infinity });
}

export async function saveModelSetting(purpose: ModelPurpose, value: RunModel) {
  await tauri.setSetting(settingKey(purpose), JSON.stringify(value));
  queryClient.setQueryData(['setting', settingKey(purpose)], value);
}

/** The pick made in a popover for this repo, if any; Settings holds the fallback. */
export function readRepoModel(purpose: ModelPurpose, repoPath: string): RunModel | null {
  try {
    const value = localStorage.getItem(`${REPO_KEY}${purpose}:${repoPath}`);
    return value ? parseRunModel(value) : null;
  } catch {
    return null;
  }
}

export function writeRepoModel(purpose: ModelPurpose, repoPath: string, value: RunModel) {
  try {
    localStorage.setItem(`${REPO_KEY}${purpose}:${repoPath}`, JSON.stringify(value));
  } catch {
    return;
  }
}
