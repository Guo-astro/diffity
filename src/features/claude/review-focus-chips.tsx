import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/api';
import { buttonClaudeSolid, buttonGhost, inputField } from '../../components/ui/button-styles';
import { PencilIcon, PlusIcon } from '../../components/ui/icon';
import { REVIEW_FOCUSES, focusesForRepo, nameProblem, useCustomFocuses, type CustomFocus } from './review-focuses';

interface FocusChipsProps {
  repoPath: string;
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
}

const chipClass = (active: boolean) =>
  cn(
    'h-6 px-2.5 rounded-full border text-xs transition-colors cursor-pointer',
    active ? 'border-claude/40 bg-claude/12 text-claude font-medium' : 'border-control-border bg-raised text-text-secondary hover:text-text',
  );

/** The built-in focus chips, the user's own (`CustomFocus`), and + to write one. */
export function FocusChips(props: FocusChipsProps) {
  const { repoPath, selected, onSelectedChange } = props;
  const { all, upsert, remove } = useCustomFocuses();
  const custom = focusesForRepo(all, repoPath);
  const [editing, setEditing] = useState<CustomFocus | null>(null);

  const toggle = (name: string) => {
    onSelectedChange(selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]);
  };

  const startNew = () => {
    setEditing({ id: crypto.randomUUID(), name: '', instructions: '', repoPath: null });
  };

  const saved = (focus: CustomFocus, previousName: string | null) => {
    setEditing(null);
    const rest = selected.filter((item) => item !== previousName);
    onSelectedChange(rest.includes(focus.name) ? rest : [...rest, focus.name]);
  };

  const removed = (focus: CustomFocus) => {
    setEditing(null);
    onSelectedChange(selected.filter((item) => item !== focus.name));
    remove(focus.id).catch((error) => toast.error('Could not delete the focus', { description: errorMessage(error) }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Focus areas">
        {REVIEW_FOCUSES.map((name) => (
          <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => toggle(name)} className={chipClass(selected.includes(name))}>
            {name}
          </button>
        ))}
        {custom.map((focus) => {
          const active = selected.includes(focus.name);
          return (
            <span key={focus.id} className={cn(chipClass(active), 'group inline-flex items-center gap-1 pr-1')}>
              <button type="button" aria-pressed={active} onClick={() => toggle(focus.name)} title={focus.instructions} className="cursor-pointer">
                {focus.name}
              </button>
              <button
                type="button"
                onClick={() => setEditing(focus)}
                className="w-4 h-4 inline-flex items-center justify-center rounded-full opacity-60 group-hover:opacity-100 hover:bg-hover cursor-pointer"
                title={`Edit ${focus.name}`}
                aria-label={`Edit ${focus.name}`}
              >
                <PencilIcon className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={startNew}
          className={cn(chipClass(false), 'w-6 px-0 inline-flex items-center justify-center')}
          title="Add your own focus, such as a team checklist or a skill to use"
          aria-label="Add your own focus"
        >
          <PlusIcon className="w-3 h-3" />
        </button>
      </div>
      {editing && (
        <FocusForm
          key={editing.id}
          focus={editing}
          isNew={!all.some((item) => item.id === editing.id)}
          repoPath={repoPath}
          shown={custom}
          onSave={(focus) => {
            const previous = all.find((item) => item.id === focus.id)?.name ?? null;
            upsert(focus).then(
              () => saved(focus, previous),
              (error) => toast.error('Could not save the focus', { description: errorMessage(error) }),
            );
          }}
          onDelete={() => removed(editing)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface FocusFormProps {
  focus: CustomFocus;
  isNew: boolean;
  repoPath: string;
  shown: CustomFocus[];
  onSave: (focus: CustomFocus) => void;
  onDelete: () => void;
  onCancel: () => void;
}

function FocusForm(props: FocusFormProps) {
  const { focus, isNew, repoPath, shown, onSave, onDelete, onCancel } = props;
  const [name, setName] = useState(focus.name);
  const [instructions, setInstructions] = useState(focus.instructions);
  const [thisRepo, setThisRepo] = useState(focus.repoPath !== null);
  const [touched, setTouched] = useState(false);
  const problem = nameProblem(name, shown, focus.id) ?? (instructions.trim() ? null : 'Say what the review should look for');

  const save = () => {
    setTouched(true);
    if (problem) {
      return;
    }
    onSave({ id: focus.id, name: name.trim(), instructions: instructions.trim(), repoPath: thisRepo ? repoPath : null });
  };

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-bg-secondary"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || event.target instanceof HTMLInputElement)) {
          event.preventDefault();
          event.stopPropagation();
          save();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name, for example “Perf review”"
        maxLength={40}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-label="Focus name"
        className={inputField}
      />
      <textarea
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        rows={3}
        placeholder="What to look for, for example “Use the perf-review skill. Check allocations in hot paths.”"
        aria-label="Focus instructions"
        className={cn(inputField, 'h-auto py-2 leading-5 resize-y min-h-[68px]')}
      />
      <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
        <input type="checkbox" checked={thisRepo} onChange={(event) => setThisRepo(event.target.checked)} className="accent-claude cursor-pointer" />
        Only in this repository
      </label>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-deleted">{touched ? problem : null}</span>
        {!isNew && (
          <button type="button" onClick={onDelete} className={cn(buttonGhost, 'text-deleted')}>
            Delete
          </button>
        )}
        <button type="button" onClick={onCancel} className={buttonGhost}>
          Cancel
        </button>
        <button type="button" onClick={save} className={buttonClaudeSolid}>
          {isNew ? 'Add focus' : 'Save'}
        </button>
      </div>
    </div>
  );
}
