import type { Subscription } from '@/libs/payments/queries';
import { useTranslations } from 'next-intl';
import { ManageButton } from './ManageButton';

// One-time payments have nothing to manage, so they render read-only. Stripe
// subscriptions open the hosted portal; Razorpay's cancel is immediate and
// irreversible from here, so it asks first.
export const CurrentPlanCard = ({ subscription }: { subscription: Subscription }) => {
  const t = useTranslations('BillingPage');
  const manageable = subscription.mode === 'subscription';

  return (
    <div className="rounded-md bg-card p-5">
      <div className="text-lg font-semibold">{t('current_plan_title')}</div>

      <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
        <dt className="text-muted-foreground">{t('label_plan')}</dt>
        <dd className="font-medium">{subscription.planId}</dd>

        <dt className="text-muted-foreground">{t('label_status')}</dt>
        <dd className="font-medium">{t(`status_${subscription.status}`)}</dd>

        <dt className="text-muted-foreground">{t('label_provider')}</dt>
        <dd className="font-medium">{subscription.provider}</dd>

        <dt className="text-muted-foreground">{t('label_mode')}</dt>
        <dd className="font-medium">{t(`mode_${subscription.mode}`)}</dd>
      </dl>

      <div className="mt-6">
        {manageable
          ? (
              <ManageButton
                confirmText={subscription.provider === 'razorpay' ? t('cancel_confirm') : undefined}
              >
                {subscription.provider === 'stripe' ? t('manage_billing') : t('cancel_subscription')}
              </ManageButton>
            )
          : (
              <p className="text-sm text-muted-foreground">{t('one_time_note')}</p>
            )}
      </div>
    </div>
  );
};
