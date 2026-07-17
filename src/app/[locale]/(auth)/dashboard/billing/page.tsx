import { auth } from '@clerk/nextjs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BillingHistory } from '@/features/billing/BillingHistory';
import { CurrentPlanCard } from '@/features/billing/CurrentPlanCard';
import { PlanCheckout } from '@/features/billing/PlanCheckout';
import { NotAuthorized } from '@/features/dashboard/NotAuthorized';
import { TitleBar } from '@/features/dashboard/TitleBar';
import { isOrgAdmin } from '@/libs/authz';
import { getBillingEvents } from '@/libs/payments/events';
import { getActiveSubscription } from '@/libs/payments/queries';
import { AllPlans } from '@/utils/PricingPlans';

export default async function BillingPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'BillingPage' });

  // Billing is admin-only. The API routes gate independently — this is the UI half.
  if (!(await isOrgAdmin())) {
    return <NotAuthorized />;
  }

  const { orgId } = await auth();
  const [subscription, events] = orgId
    ? await Promise.all([getActiveSubscription(orgId), getBillingEvents(orgId)])
    : [null, []];
  const paidPlans = AllPlans.filter(plan => plan.price > 0);

  return (
    <>
      <TitleBar title={t('title_bar')} description={t('title_bar_description')} />

      {subscription
        ? <CurrentPlanCard subscription={subscription} />
        : (
            <div className="rounded-md bg-card p-5">
              <div className="text-lg font-semibold">{t('no_plan_title')}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('no_plan_description')}
              </p>

              <div className="
                mt-6 grid grid-cols-1 gap-4
                @2xl:grid-cols-2
              "
              >
                {paidPlans.map(plan => (
                  <div
                    key={plan.name}
                    className="rounded-xl border border-border p-5"
                  >
                    <div className="font-semibold">{plan.name}</div>
                    <div className="mt-1 mb-4 text-2xl font-bold">
                      {t('plan_price', { price: plan.price })}
                    </div>
                    <PlanCheckout planId={plan.name} />
                  </div>
                ))}
              </div>
            </div>
          )}

      <BillingHistory events={events} />
    </>
  );
}

export const dynamic = 'force-dynamic';
