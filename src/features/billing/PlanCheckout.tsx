import type { PaymentMode } from '@/libs/payments/types';
import { useTranslations } from 'next-intl';
import { getCheckoutProviders } from '@/libs/payments/planRefs';
import { CheckoutButton } from './CheckoutButton';

type Props = {
  planId: string;
  mode?: PaymentMode;
};

// Server component: gateway keys are server-side, so provider availability is
// resolved here and only configured gateways get a button. Assumes an authed
// user with an active org — mount it inside the dashboard, not public pages.
export const PlanCheckout = ({ planId, mode = 'subscription' }: Props) => {
  const t = useTranslations('PlanCheckout');
  const providers = getCheckoutProviders(planId, mode);

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('no_gateway_configured')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map(provider => (
        <CheckoutButton key={provider} planId={planId} provider={provider} mode={mode}>
          {t('pay_with', { provider: t(`provider_${provider}`) })}
        </CheckoutButton>
      ))}
    </div>
  );
};
