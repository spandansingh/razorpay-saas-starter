import { useTranslations } from 'next-intl';
import { PageMessage } from './PageMessage';

// Shown wherever a member lands on an admin-only surface — a plain explanation
// instead of a blank page or a stack trace.
export const NotAuthorized = () => {
  const t = useTranslations('NotAuthorized');

  return (
    <PageMessage
      icon={(
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M0 0h24v24H0z" stroke="none" />
          <path d="M5 13a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6zM11 16a1 1 0 102 0 1 1 0 10-2 0M8 11V7a4 4 0 118 0v4" />
        </svg>
      )}
      title={t('title')}
      description={t('description')}
      button={null}
    />
  );
};
