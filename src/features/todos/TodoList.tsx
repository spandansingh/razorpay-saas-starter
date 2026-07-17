'use client';

import type { Todo } from './queries';
import { useTranslations } from 'next-intl';
import { useOptimistic, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { createTodo, deleteTodo } from './actions';
import { TodoItem } from './TodoItem';

type OptimisticAction
  = | { type: 'add'; todo: Todo }
    | { type: 'remove'; id: number };

// Optimistic rows carry a temporary negative id — real ids come from a serial
// sequence, so a negative one can never collide with a persisted row.
const TEMP_ID = -1;

export function TodoList({ todos }: { todos: Todo[] }) {
  const t = useTranslations('Todos');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [optimisticTodos, applyOptimistic] = useOptimistic(
    todos,
    (state: Todo[], action: OptimisticAction) =>
      action.type === 'add'
        ? [action.todo, ...state]
        : state.filter(todo => todo.id !== action.id),
  );

  async function create(formData: FormData) {
    const input = {
      title: String(formData.get('title') ?? ''),
      message: String(formData.get('message') ?? ''),
    };

    setError(null);
    const now = new Date();
    applyOptimistic({
      type: 'add',
      todo: { id: TEMP_ID, orgId: '', ownerId: '', createdAt: now, updatedAt: now, ...input },
    });

    const result = await createTodo(input);
    if (result.ok) {
      formRef.current?.reset();
    } else {
      // The optimistic row disappears on its own when the action settles.
      setError(t(`error_${result.error}`));
    }
  }

  async function remove(id: number) {
    setError(null);
    applyOptimistic({ type: 'remove', id });

    const result = await deleteTodo(id);
    if (!result.ok) {
      setError(t(`error_${result.error}`));
    }
  }

  return (
    <div className="rounded-md bg-card p-5">
      <form ref={formRef} action={create} className="flex flex-col gap-2">
        <input
          name="title"
          placeholder={t('field_title')}
          aria-label={t('field_title')}
          className="rounded-md border border-border px-3 py-2 text-sm"
        />
        <textarea
          name="message"
          placeholder={t('field_message')}
          aria-label={t('field_message')}
          className="rounded-md border border-border px-3 py-2 text-sm"
        />

        <div>
          <button type="submit" className={buttonVariants({ size: 'sm' })}>
            {t('add')}
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {optimisticTodos.length === 0
        ? <p className="mt-6 text-sm text-muted-foreground">{t('empty')}</p>
        : (
            <ul className="mt-6 space-y-3">
              {optimisticTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onDelete={remove}
                  pending={todo.id === TEMP_ID}
                />
              ))}
            </ul>
          )}
    </div>
  );
}
