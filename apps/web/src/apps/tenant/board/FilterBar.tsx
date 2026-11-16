import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { EMPTY_FILTERS, hasFilters, type BoardFilters } from './filters';

interface FilterBarProps {
  value: BoardFilters;
  onChange: (f: BoardFilters) => void;
  statuses: { id: string; name: string }[];
  members: { id: string; name: string }[];
  showStatus?: boolean;
}

/** One row of filters above the board and the charts. */
export function FilterBar({ value, onChange, statuses, members, showStatus = true }: FilterBarProps) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...value, ...patch });
  // Debounce typing so every keystroke doesn't refetch every column.
  const [search, setSearch] = useState(value.search);
  const [lastSearch, setLastSearch] = useState(value.search);
  if (value.search !== lastSearch) {
    setLastSearch(value.search);
    setSearch(value.search);
  }
  useEffect(() => {
    if (search === value.search) return;
    const t = setTimeout(() => onChange({ ...value, search }), 300);
    return () => clearTimeout(t);
  }, [search, value, onChange]);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2" role="search" aria-label="Filter tasks">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search tasks"
          placeholder="Search title or KEY-12"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {showStatus && (
        <NativeSelect
          aria-label="Status"
          className="w-40"
          value={value.statusId}
          onChange={(e) => set({ statusId: e.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <NativeSelect
        aria-label="Assignee"
        className="w-40"
        value={value.assigneeId}
        onChange={(e) => set({ assigneeId: e.target.value })}
      >
        <option value="">Anyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Priority"
        className="w-36"
        value={value.priority}
        onChange={(e) => set({ priority: e.target.value as BoardFilters['priority'] })}
      >
        <option value="">Any priority</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </NativeSelect>
      <label className="grid gap-0.5 text-xs text-muted-foreground">
        Due from
        <Input
          type="date"
          aria-label="Due from"
          className="w-38"
          value={value.dueFrom}
          max={value.dueTo || undefined}
          onChange={(e) => set({ dueFrom: e.target.value })}
        />
      </label>
      <label className="grid gap-0.5 text-xs text-muted-foreground">
        Due to
        <Input
          type="date"
          aria-label="Due to"
          className="w-38"
          value={value.dueTo}
          min={value.dueFrom || undefined}
          onChange={(e) => set({ dueTo: e.target.value })}
        />
      </label>
      <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
        <input
          type="checkbox"
          className="accent-primary"
          checked={value.overdue}
          onChange={(e) => set({ overdue: e.target.checked })}
        />
        Overdue only
      </label>
      {hasFilters(value) && (
        <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
