import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { TaskDetailQuery } from '@/api/generated/graphql';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTenantSession } from '../session';
import { useTaskMutations } from './queries';
import { initials } from './TaskCard';

type Comment = NonNullable<TaskDetailQuery['task']>['comments'][number];
type Reply = Comment['replies'][number];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function CommentForm({
  placeholder,
  submitLabel,
  initial = '',
  onSubmit,
  onCancel,
  busy,
}: {
  placeholder: string;
  submitLabel: string;
  initial?: string;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  busy: boolean;
}) {
  const [body, setBody] = useState(initial);
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSubmit(body.trim());
      }}
    >
      <Textarea
        aria-label={placeholder}
        placeholder={placeholder}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function CommentItem({
  c,
  taskId,
  projectId,
  canWrite,
  canModerate,
  onReply,
}: {
  c: Comment | Reply;
  taskId: string;
  projectId: string;
  canWrite: boolean;
  canModerate: boolean;
  onReply?: () => void;
}) {
  const { user } = useTenantSession();
  const { editComment, deleteComment } = useTaskMutations(projectId);
  const [editing, setEditing] = useState(false);
  const mine = c.author.id === user?.id;
  const onError = (err: unknown) => toast.error(errorMessage(err));

  return (
    <div className="flex gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-800">
        {initials(c.author.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-semibold">{c.author.name}</span>{' '}
          <span className="text-muted-foreground">{when(c.createdAt)}</span>
          {c.editedAt && !c.isDeleted && <span className="text-muted-foreground"> · edited</span>}
        </p>
        {c.isDeleted ? (
          <p className="text-sm text-muted-foreground italic">This comment was deleted.</p>
        ) : editing ? (
          <CommentForm
            placeholder="Edit comment"
            submitLabel="Save"
            initial={c.body}
            busy={editComment.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(body) =>
              editComment.mutate({ taskId, id: c.id, body }, { onSuccess: () => setEditing(false), onError })
            }
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{c.body}</p>
        )}
        {!c.isDeleted && !editing && (
          <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
            {onReply && canWrite && (
              <button type="button" className="hover:text-foreground" onClick={onReply}>
                Reply
              </button>
            )}
            {mine && canWrite && (
              <button type="button" className="hover:text-foreground" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {(mine || canModerate) && canWrite && (
              <button
                type="button"
                className="hover:text-destructive"
                onClick={() =>
                  window.confirm('Delete this comment?') &&
                  deleteComment.mutate({ taskId, id: c.id }, { onError })
                }
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Comment thread with one level of replies. */
export function Comments({
  taskId,
  projectId,
  comments,
  canWrite,
  canModerate,
}: {
  taskId: string;
  projectId: string;
  comments: Comment[];
  canWrite: boolean;
  canModerate: boolean;
}) {
  const { addComment } = useTaskMutations(projectId);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const onError = (err: unknown) => toast.error(errorMessage(err));
  return (
    <div className="grid gap-4">
      {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="grid gap-3">
          <CommentItem
            c={c}
            taskId={taskId}
            projectId={projectId}
            canWrite={canWrite}
            canModerate={canModerate}
            onReply={() => setReplyTo(c.id)}
          />
          {(c.replies.length > 0 || replyTo === c.id) && (
            <div className="ml-9 grid gap-3 border-l-2 border-brand-100 pl-3">
              {c.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  c={r}
                  taskId={taskId}
                  projectId={projectId}
                  canWrite={canWrite}
                  canModerate={canModerate}
                />
              ))}
              {replyTo === c.id && (
                <CommentForm
                  placeholder={`Reply to ${c.author.name}`}
                  submitLabel="Reply"
                  busy={addComment.isPending}
                  onCancel={() => setReplyTo(null)}
                  onSubmit={(body) =>
                    addComment.mutate(
                      { taskId, body, parentId: c.id },
                      { onSuccess: () => setReplyTo(null), onError },
                    )
                  }
                />
              )}
            </div>
          )}
        </div>
      ))}
      {canWrite && (
        <CommentForm
          key={comments.length}
          placeholder="Write a comment"
          submitLabel="Comment"
          busy={addComment.isPending}
          onSubmit={(body) => addComment.mutate({ taskId, body }, { onError })}
        />
      )}
    </div>
  );
}
