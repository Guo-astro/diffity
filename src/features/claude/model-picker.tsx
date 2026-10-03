import { useState } from 'react';
import { cn } from '../../lib/cn';
import * as tauri from '../../lib/tauri';
import type { ModelCatalog } from '../../lib/types';
import { MenuItem, MenuLabel, MenuSeparator, Popover, useMenu } from '../../components/ui/popover';
import { ChevronDownIcon } from '../../components/ui/icon';
import { Spinner } from '../../components/icons/spinner';
import { findModel, refreshModelCatalog, runModelLabel, useModelCatalog, useModelCatalogs, withModel, type RunPick } from './model-setting';
import { agentMeta, useInstalledAgents, type AgentMeta } from './agents';

interface ModelMenuProps {
  value: RunPick;
  onChange: (value: RunPick) => void;
}

interface GroupProps {
  agent: AgentMeta;
  catalog: ModelCatalog | null | undefined;
  loading: boolean;
  error: string | null;
  value: RunPick;
  onChange: (value: RunPick) => void;
  onRetry: () => void;
}

function AgentModels(props: GroupProps) {
  const { agent, catalog, loading, error, value, onChange, onRetry } = props;
  const current = value.agent === agent.id;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-text-muted">
        <Spinner />
        Reading models from {agent.name}…
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="flex flex-col gap-1.5 px-2.5 py-2 text-xs">
        <span className="text-text-secondary">{error ?? `${agent.name} did not list any models.`}</span>
        <button type="button" onClick={onRetry} className="self-start text-text-muted hover:text-text cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  const pick = (model: string | undefined) => {
    if (current) {
      onChange({ agent: agent.id, ...withModel(catalog, value, model) });
      return;
    }
    onChange({ agent: agent.id, model });
  };

  return (
    <>
      <MenuItem
        label={`${agent.name} setting`}
        hint={findModel(catalog, catalog.currentModel)?.name}
        checked={current && !value.model}
        onSelect={() => pick(undefined)}
      />
      {catalog.models.map((model) => (
        <MenuItem key={model.value} label={model.name} checked={current && value.model === model.value} onSelect={() => pick(model.value)} />
      ))}
    </>
  );
}

/** Every installed agent's models, grouped by agent, plus the picked model's effort levels. Picking a model picks its agent. */
export function ModelMenu(props: ModelMenuProps) {
  const { value, onChange } = props;
  const installed = useInstalledAgents();
  const agents = installed.length > 0 ? installed : [agentMeta(value.agent)];
  const queries = useModelCatalogs(agents.map((agent) => agent.id));
  const grouped = agents.length > 1;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = async (ids: string[]) => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await Promise.all(ids.map((id) => refreshModelCatalog(id)));
    } catch (err) {
      setRefreshError(tauri.errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const selected = queries[agents.findIndex((agent) => agent.id === value.agent)]?.data;
  const effective = findModel(selected, value.model) ?? findModel(selected, selected?.currentModel);
  const efforts = effective?.efforts ?? [];
  const source = grouped ? 'From your installed agents' : `From your ${agents[0].name} install`;

  return (
    <>
      {agents.map((agent, index) => {
        const query = queries[index];
        return (
          <div key={agent.id}>
            {index > 0 && <MenuSeparator />}
            {grouped && <MenuLabel>{agent.name}</MenuLabel>}
            <AgentModels
              agent={agent}
              catalog={query?.data}
              loading={!!query?.isLoading || (refreshing && !query?.data)}
              error={query?.error ? tauri.errorMessage(query.error) : null}
              value={value}
              onChange={onChange}
              onRetry={() => void refresh([agent.id])}
            />
          </div>
        );
      })}
      {efforts.length > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel>Effort</MenuLabel>
          <div className="flex flex-wrap gap-0.5 px-1.5 pb-1">
            {efforts.map((effort) => {
              const active = value.effort === effort.value;
              return (
                <button
                  key={effort.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...value, effort: active ? undefined : effort.value })}
                  className={cn(
                    'h-6 px-2 rounded-md text-xs transition-colors cursor-pointer',
                    active ? 'bg-selected text-text font-medium' : 'text-text-muted hover:text-text hover:bg-hover',
                  )}
                >
                  {effort.name}
                </button>
              );
            })}
          </div>
        </>
      )}
      <MenuSeparator />
      <div className="flex items-center justify-between gap-2 px-2.5 pt-0.5 pb-1 text-[11px] text-text-muted">
        <span className="truncate">{refreshError ?? source}</span>
        <button
          type="button"
          onClick={() => void refresh(agents.map((agent) => agent.id))}
          disabled={refreshing}
          className="inline-flex items-center gap-1 shrink-0 hover:text-text cursor-pointer disabled:cursor-default"
        >
          {refreshing && <Spinner />}
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </>
  );
}

/** Short label like "Opus 5.5 · High"; names the agent when its own model is unknown. */
export function usePickLabel(value: RunPick): string {
  const { data: catalog } = useModelCatalog(value.agent);
  return runModelLabel(catalog, value, `${agentMeta(value.agent).short} default`);
}

interface ModelPickerProps extends ModelMenuProps {
  align?: 'start' | 'end';
  className?: string;
}

/** Quiet text button ("Opus 5.5 · High") that opens the model menu. */
export function ModelPicker(props: ModelPickerProps) {
  const { value, onChange, align = 'start', className } = props;
  const { open, close, toggle, anchorRef } = useMenu();
  const label = usePickLabel(value);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title="Model and thinking effort"
        className={cn(
          'inline-flex items-center gap-1 h-6 px-1.5 min-w-0 rounded-md text-xs text-text-muted hover:text-text hover:bg-hover transition-colors cursor-pointer',
          open && 'bg-hover text-text',
          className,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon size="xs" className="shrink-0" />
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} align={align} width={260}>
        <div className="max-h-[60vh] overflow-y-auto">
          <ModelMenu value={value} onChange={onChange} />
        </div>
      </Popover>
    </>
  );
}
