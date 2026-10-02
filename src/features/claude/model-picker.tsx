import { useState } from 'react';
import { cn } from '../../lib/cn';
import * as tauri from '../../lib/tauri';
import type { RunModel } from '../../lib/types';
import { MenuItem, MenuLabel, MenuSeparator, Popover, useMenu } from '../../components/ui/popover';
import { ChevronDownIcon } from '../../components/ui/icon';
import { Spinner } from '../../components/icons/spinner';
import { findModel, refreshModelCatalog, runModelLabel, useModelCatalog, withModel } from './model-setting';

interface ModelMenuProps {
  value: RunModel;
  onChange: (value: RunModel) => void;
}

/** Model list plus the picked model's effort levels, exactly as Claude Code reports them. */
export function ModelMenu(props: ModelMenuProps) {
  const { value, onChange } = props;
  const { data: catalog, isLoading, error } = useModelCatalog();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshModelCatalog();
    } catch (err) {
      setRefreshError(tauri.errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading || (refreshing && !catalog)) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-text-muted">
        <Spinner />
        Reading models from Claude Code…
      </div>
    );
  }

  if (!catalog) {
    const message = refreshError ?? (error ? tauri.errorMessage(error) : 'Claude Code did not list any models.');
    return (
      <div className="flex flex-col gap-1.5 px-2.5 py-2 text-xs">
        <span className="text-text-secondary">{message}</span>
        <button type="button" onClick={() => void refresh()} className="self-start text-text-muted hover:text-text cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  const effective = findModel(catalog, value.model) ?? findModel(catalog, catalog.currentModel);
  const efforts = effective?.efforts ?? [];
  const ownModel = findModel(catalog, catalog.currentModel)?.name;

  return (
    <>
      <MenuItem label="Claude Code setting" hint={ownModel} checked={!value.model} onSelect={() => onChange(withModel(catalog, value, undefined))} />
      <MenuSeparator />
      {catalog.models.map((model) => (
        <MenuItem
          key={model.value}
          label={model.name}
          checked={value.model === model.value}
          onSelect={() => onChange(withModel(catalog, value, model.value))}
        />
      ))}
      {efforts.length > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel>Effort</MenuLabel>
          <div className="flex flex-wrap gap-0.5 px-1.5 pb-1">
            {efforts.map((effort) => {
              const selected = value.effort === effort.value;
              return (
                <button
                  key={effort.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...value, effort: selected ? undefined : effort.value })}
                  className={cn(
                    'h-6 px-2 rounded-md text-xs transition-colors cursor-pointer',
                    selected ? 'bg-selected text-text font-medium' : 'text-text-muted hover:text-text hover:bg-hover',
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
        <span className="truncate">{refreshError ?? 'From your Claude Code install'}</span>
        <button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex items-center gap-1 shrink-0 hover:text-text cursor-pointer disabled:cursor-default">
          {refreshing && <Spinner />}
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </>
  );
}

interface ModelPickerProps extends ModelMenuProps {
  align?: 'start' | 'end';
  className?: string;
}

/** Quiet text button ("Opus 5.5 · High") that opens the model menu. */
export function ModelPicker(props: ModelPickerProps) {
  const { value, onChange, align = 'start', className } = props;
  const { open, close, toggle, anchorRef } = useMenu();
  const { data: catalog } = useModelCatalog();

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
        <span className="truncate">{runModelLabel(catalog, value)}</span>
        <ChevronDownIcon size="xs" className="shrink-0" />
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} align={align} width={260}>
        <ModelMenu value={value} onChange={onChange} />
      </Popover>
    </>
  );
}
