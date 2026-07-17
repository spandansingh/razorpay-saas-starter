import { auth } from '@clerk/nextjs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TitleBar } from '@/features/dashboard/TitleBar';
import { getTodos } from '@/features/todos/queries';
import { TodoList } from '@/features/todos/TodoList';

export default async function DashboardIndexPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'DashboardIndexPage',
  });

  // The middleware sends anyone without an active org to org selection, so orgId
  // is present here in practice; the fallback keeps the page from throwing.
  const { orgId } = await auth();
  const todos = orgId ? await getTodos(orgId) : [];

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <TodoList todos={todos} />
    </>
  );
};

export const dynamic = 'force-dynamic';
