import type { KeyboardEvent, ReactNode } from 'react';
import { SearchIcon } from './icon';

interface PopoverSearchProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  trailing?: ReactNode;
}

/** The search row at the top of a popover: the row is the field, so it has no box of its own. */
export function PopoverSearch(props: PopoverSearchProps) {
  const { value, onChange, onKeyDown, placeholder, trailing } = props;

  return (
    <div className="shrink-0 flex items-center gap-2 h-10 px-3 border-b border-overlay-border">
      <SearchIcon className="w-3.5 h-3.5 shrink-0 text-text-muted" />
      <input
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
      />
      {trailing}
    </div>
  );
}
