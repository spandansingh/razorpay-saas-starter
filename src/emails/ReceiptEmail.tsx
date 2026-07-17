import type { RenderedEmail } from './render';
import { Button, Column, Row, Text } from '@react-email/components';
import { Env } from '@/libs/Env';
import { EmailLayout, emailTheme } from './EmailLayout';
import { renderEmail } from './render';

// Gateways report money in minor units (paise/cents).
const MINOR_UNITS_PER_MAJOR = 100;

type ReceiptProps = {
  planId: string;
  status: string;
  /** Minor units, as the gateway reports it. Omitted when the event carries no amount. */
  amount?: number;
  currency?: string;
  billingUrl: string;
};

const paragraph = {
  color: emailTheme.foreground,
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
} as const;

const label = {
  color: emailTheme.mutedForeground,
  fontSize: '13px',
  margin: '0 0 4px',
} as const;

const value = {
  color: emailTheme.foreground,
  fontSize: '13px',
  fontWeight: 600,
  margin: '0 0 4px',
} as const;

function formatAmount(amount?: number, currency?: string): string | null {
  if (amount === undefined || !currency) {
    return null;
  }
  return new Intl.NumberFormat('en', { style: 'currency', currency })
    .format(amount / MINOR_UNITS_PER_MAJOR);
}

// The render function below is this module's public API — the component is an
// implementation detail, so callers can't render it without the right props.
const ReceiptEmail = ({ planId, status, amount, currency, billingUrl }: ReceiptProps) => {
  const formatted = formatAmount(amount, currency);

  return (
    <EmailLayout preview={`Your ${planId} plan is ${status}.`}>
      <Text style={{ ...paragraph, fontSize: '18px', fontWeight: 600 }}>
        Thanks for your purchase
      </Text>

      <Text style={paragraph}>
        Your
        {' '}
        {planId}
        {' '}
        plan is now
        {' '}
        {status}
        . Here are the details for your records.
      </Text>

      <Row>
        <Column>
          <Text style={label}>Plan</Text>
          <Text style={value}>{planId}</Text>
        </Column>
        <Column>
          <Text style={label}>Status</Text>
          <Text style={value}>{status}</Text>
        </Column>
        {formatted
          ? (
              <Column>
                <Text style={label}>Amount</Text>
                <Text style={value}>{formatted}</Text>
              </Column>
            )
          : null}
      </Row>

      <Button
        href={billingUrl}
        style={{
          backgroundColor: emailTheme.primary,
          borderRadius: '6px',
          color: emailTheme.primaryForeground,
          display: 'inline-block',
          fontSize: '14px',
          fontWeight: 600,
          marginTop: '24px',
          padding: '10px 20px',
          textDecoration: 'none',
        }}
      >
        View your billing
      </Button>
    </EmailLayout>
  );
};

export function renderReceiptEmail(props: Omit<ReceiptProps, 'billingUrl'>): Promise<RenderedEmail> {
  const base = Env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return renderEmail('Payment receipt', <ReceiptEmail {...props} billingUrl={`${base}/dashboard/billing`} />);
}
