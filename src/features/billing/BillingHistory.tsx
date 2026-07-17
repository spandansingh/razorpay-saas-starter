import type { BillingEvent } from '@/libs/payments/events';
import { useFormatter, useTranslations } from 'next-intl';

// Amounts are stored in minor units (paise/cents) — the gateways' own
// representation — so divide before formatting.
const MINOR_UNITS_PER_MAJOR = 100;

export const BillingHistory = ({ events }: { events: BillingEvent[] }) => {
  const t = useTranslations('BillingPage');
  const format = useFormatter();

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-md bg-card p-5">
      <div className="text-lg font-semibold">{t('history_title')}</div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">{t('history_date')}</th>
              <th className="pb-2 font-medium">{t('history_type')}</th>
              <th className="pb-2 font-medium">{t('history_amount')}</th>
              <th className="pb-2 font-medium">{t('label_status')}</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.id} className="border-t border-border">
                <td className="py-2 whitespace-nowrap">
                  {format.dateTime(event.createdAt, { dateStyle: 'medium' })}
                </td>
                {/* The gateway's own event name, shown verbatim rather than
                    translated — there is no fixed set to enumerate. */}
                <td className="py-2 font-mono text-xs">{event.type}</td>
                <td className="py-2 whitespace-nowrap">
                  {event.amount !== null && event.currency !== null
                    ? format.number(event.amount / MINOR_UNITS_PER_MAJOR, {
                        style: 'currency',
                        currency: event.currency,
                      })
                    : '—'}
                </td>
                <td className="py-2">{t(`status_${event.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
