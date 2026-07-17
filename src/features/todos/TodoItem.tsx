'use client';

import type { Todo } from './queries';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { updateTodo } from './actions';

type Props = {
  todo: Todo;
  onDelete: (id: number) => void;
  /** True while this row only exists optimistically — no server id to act on yet. */
  pending?: boolean;
};

export function TodoItem({ todo, onDelete, pending }: Props) {
  const t = useTranslations('Todos');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function save(formData: FormData) {
    const result = await updateTodo(todo.id, {
      title: formData.get('title'),
      message: formData.get('message'),
    });

    if (result.ok) {
      setEditing(false);
      setError(null);
    } else {
      setError(t(`error_${result.error}`));
    }
  }

  if (editing) {
    return (
      <li className="rounded-md border border-border p-4">
        <form action={save} className="flex flex-col gap-2">
          <input
            name="title"
            defaultValue={todo.title}
            aria-label={t('field_title')}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
          <textarea
            name="message"
            defaultValue={todo.message}
            aria-label={t('field_message')}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className="
        flex items-start justify-between gap-4 rounded-md border border-border
        p-4
      "
      // Optimistic rows are dimmed until the server confirms them.
      style={pending ? { opacity: 0.5 } : undefined}
    >
      <div>
        <div className="font-medium">{todo.title}</div>
        <div className="text-sm text-muted-foreground">{todo.message}</div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(true)}
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
        >
          {t('edit')}
        </button>
        <button
          type="button"
          disabled={pending || isPending}
          onClick={() => startTransition(() => onDelete(todo.id))}
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
        >
          {t('delete')}
        </button>
      </div>
    </li>
  );
}
