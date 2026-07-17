import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { PricingCard } from '@/features/billing/PricingCard';
import { Section } from '@/features/landing/Section';
import { Link } from '@/libs/I18nNavigation';
import { AllPlans } from '@/utils/PricingPlans';

export const Pricing = () => {
  const t = useTranslations('Pricing');

  return (
    <Section
      subtitle={t('section_subtitle')}
      title={t('section_title')}
      description={t('section_description')}
    >
      <div className="
        grid grid-cols-1 gap-x-6 gap-y-8
        @xl:grid-cols-2
        @4xl:grid-cols-3
      "
      >
        {AllPlans.map(plan => (
          <PricingCard
            key={plan.name}
            plan={plan}
            button={(
              <Link
                className={buttonVariants({
                  size: 'sm',
                  className: 'w-full',
                })}
                // The marketing pages sit outside ClerkProvider and clerkMiddleware,
                // so auth state is unknowable here — everyone routes through sign-up,
                // which lands them on the billing page where checkout actually lives.
                // `redirect_url` is the param Clerk itself honours.
                href="/sign-up?redirect_url=/dashboard/billing"
              >
                {t('button_text')}
              </Link>
            )}
          />
        ))}
      </div>
    </Section>
  );
};
