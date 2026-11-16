import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { StatusCategory } from '@/api/generated/graphql';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { reorder } from '@/lib/reorder';
import { useProjectMutations } from './queries';

export interface Status {
  id: string;
  name: string;
  category: StatusCategory;
  position: number;
  color: string;
}

export const CATEGORIES: { value: StatusCategory; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'STARTED', label: 'Started' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function StatusRow({
  status,
  editable,
  onDelete,
}: {
  status: Status;
  editable: boolean;
  onDelete: () => void;
}) {
  const { updateStatus } = useProjectMutations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
    disabled: !editable,
  });
  const [name, setName] = useState(status.name);
  const [savedName, setSavedName] = useState(status.name);
  if (status.name !== savedName) {
    // Server copy changed (save or refetch): show it.
    setSavedName(status.name);
    setName(status.name);
  }
  const onError = (err: unknown) => toast.error(errorMessage(err));
  const save = (patch: { name?: string; category?: StatusCategory; color?: string }) =>
    updateStatus.mutate({ id: status.id, ...patch }, { onError });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border bg-card p-2 ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      {editable && (
        <button
          type="button"
          className="cursor-grab touch-none p-1 text-muted-foreground"
          aria-label={`Drag ${status.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <input
        type="color"
        aria-label={`Color for ${status.name}`}
        className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-default"
        value={status.color}
        disabled={!editable}
        onChange={(e) => save({ color: e.target.value.toUpperCase() })}
      />
      {editable ? (
        <Input
          aria-label="Status name"
          className="h-8 min-w-28 flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== status.name && save({ name: name.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <span className="flex-1 text-sm font-medium">{status.name}</span>
      )}
      <NativeSelect
        aria-label={`Category for ${status.name}`}
        className="h-8 w-32"
        value={status.category}
        disabled={!editable}
        onChange={(e) => save({ category: e.target.value as StatusCategory })}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
      {editable && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Delete ${status.name}`}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

function DeleteStatusDialog({
  status,
  others,
  onClose,
}: {
  status: Status;
  others: Status[];
  onClose: () => void;
}) {
  const { deleteStatus } = useProjectMutations();
  const [target, setTarget] = useState(others[0]?.id ?? '');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{status.name}”?</DialogTitle>
          <DialogDescription>
            Tasks in this status move to the status you pick. Their history records the move.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Move tasks to" htmlFor="move-to">
          <NativeSelect id="move-to" value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!target || deleteStatus.isPending}
            onClick={() =>
              deleteStatus.mutate(
                { id: status.id, moveTasksToStatusId: target },
                {
                  onSuccess: () => (toast.success(`${status.name} deleted`), onClose()),
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Delete status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ordered statuses: drag to reorder, edit inline, add, delete (moving tasks). */
export function StatusList({
  projectId,
  statuses,
  editable,
}: {
  projectId: string;
  statuses: Status[];
  editable: boolean;
}) {
  const { moveStatus, createStatus } = useProjectMutations();
  const serverOrder = statuses.map((s) => s.id);
  const [order, setOrder] = useState(serverOrder);
  const [lastServerOrder, setLastServerOrder] = useState(serverOrder.join());
  if (serverOrder.join() !== lastServerOrder) {
    // Statuses refetched: drop the optimistic order and use the server's.
    setLastServerOrder(serverOrder.join());
    setOrder(serverOrder);
  }
  const [deleting, setDeleting] = useState<Status | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<StatusCategory>('STARTED');
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const move = reorder(order, String(active.id), String(over.id));
    if (!move) return;
    setOrder(move.order); // optimistic
    moveStatus.mutate(
      { id: String(active.id), afterStatusId: move.afterId, beforeStatusId: move.beforeId },
      { onError: (e) => (toast.error(errorMessage(e)), setOrder(statuses.map((s) => s.id))) },
    );
  };

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2" aria-label="Statuses">
            {order.map((id) => {
              const s = byId.get(id);
              return s ? (
                <StatusRow key={id} status={s} editable={editable} onDelete={() => setDeleting(s)} />
              ) : null;
            })}
          </ul>
        </SortableContext>
      </DndContext>

      {editable && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            createStatus.mutate(
              { projectId, name: newName.trim(), category: newCategory },
              { onSuccess: () => setNewName(''), onError: (err) => toast.error(errorMessage(err)) },
            );
          }}
        >
          <Input
            aria-label="New status name"
            placeholder="New status, e.g. In Review"
            className="h-9 max-w-xs flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <NativeSelect
            aria-label="New status category"
            className="w-36"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as StatusCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="secondary" disabled={createStatus.isPending}>
            <Plus /> Add status
          </Button>
        </form>
      )}
      {deleting && (
        <DeleteStatusDialog
          status={deleting}
          others={statuses.filter((s) => s.id !== deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
