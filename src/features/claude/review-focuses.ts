import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as tauri from '../../lib/tauri';

export const REVIEW_FOCUSES = ['Security', 'Performance', 'Correctness', 'Naming', 'Tests', 'Types'] as const;

/** A focus the user wrote: a chip next to the built-in ones whose instructions go into the review prompt. */
export interface CustomFocus {
  id: string;
  name: string;
  instructions: string;
  /** The repository it belongs to; null shows it in every repository. */
  repoPath: string | null;
}

const SETTING_KEY = 'review-focuses';
const QUERY_KEY = ['setting', SETTING_KEY];

export function parseCustomFocuses(raw: string | null | undefined): CustomFocus[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is CustomFocus => {
      const focus = item as Partial<CustomFocus>;
      return typeof focus?.id === 'string' && typeof focus.name === 'string' && typeof focus.instructions === 'string';
    }).map((focus) => ({ ...focus, repoPath: typeof focus.repoPath === 'string' ? focus.repoPath : null }));
  } catch {
    return [];
  }
}

export function focusesForRepo(all: CustomFocus[], repoPath: string): CustomFocus[] {
  return all.filter((focus) => focus.repoPath === null || focus.repoPath === repoPath);
}

/** Why a name can't be used, or null: names must be unique among the chips shown in this repository. */
export function nameProblem(name: string, shown: CustomFocus[], editingId: string | null): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Give it a name';
  }
  const taken = [...REVIEW_FOCUSES, ...shown.filter((focus) => focus.id !== editingId).map((focus) => focus.name)];
  if (taken.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
    return 'A focus with this name already exists';
  }
  return null;
}

/**
 * What a review run gets from the chosen chips and the typed text: every chip name as the focus, and the custom
 * chips' instructions added to the user's own (which the review prompt puts first).
 */
export function reviewRequest(selected: string[], custom: CustomFocus[], text: string): { focus?: string; instructions?: string } {
  const chosen = custom.filter((focus) => selected.includes(focus.name));
  const builtIn = selected.filter((name) => (REVIEW_FOCUSES as readonly string[]).includes(name));
  const names = [...builtIn, ...chosen.map((focus) => focus.name)];
  const parts = [text.trim(), ...chosen.map((focus) => `${focus.name}: ${focus.instructions.trim()}`)].filter(Boolean);
  return {
    focus: names.length > 0 ? names.join(', ') : undefined,
    instructions: parts.length > 0 ? parts.join('\n\n') : undefined,
  };
}

export function useCustomFocuses() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: QUERY_KEY, queryFn: () => tauri.getSetting(SETTING_KEY), staleTime: 60_000 });
  const all = parseCustomFocuses(data);

  const save = async (next: CustomFocus[]) => {
    const value = JSON.stringify(next);
    queryClient.setQueryData(QUERY_KEY, value);
    await tauri.setSetting(SETTING_KEY, value);
  };

  return {
    all,
    upsert: (focus: CustomFocus) => save(all.some((item) => item.id === focus.id) ? all.map((item) => (item.id === focus.id ? focus : item)) : [...all, focus]),
    remove: (id: string) => save(all.filter((item) => item.id !== id)),
  };
}
