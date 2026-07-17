import type { RenderedEmail } from './render';
import { Button, Text } from '@react-email/components';
import { Env } from '@/libs/Env';
import { EmailLayout, emailTheme } from './EmailLayout';
import { renderEmail } from './render';

const paragraph = {
  color: emailTheme.foreground,
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
} as const;

// The render function below is this module's public API — the component is an
// implementation detail, so callers can't render it without the right props.
const WelcomeEmail = ({ dashboardUrl }: { dashboardUrl: string }) => (
  <EmailLayout preview="Your workspace is ready.">
    <Text style={{ ...paragraph, fontSize: '18px', fontWeight: 600 }}>
      Welcome aboard 👋
    </Text>

    <Text style={paragraph}>
      Thanks for signing up — your workspace is ready. Head to your dashboard to
      invite your team and get started.
    </Text>

    <Button
      href={dashboardUrl}
      style={{
        backgroundColor: emailTheme.primary,
        borderRadius: '6px',
        color: emailTheme.primaryForeground,
        display: 'inline-block',
        fontSize: '14px',
        fontWeight: 600,
        padding: '10px 20px',
        textDecoration: 'none',
      }}
    >
      Open your dashboard
    </Button>
  </EmailLayout>
);

/** Adding an email = a component like the one above plus a render function like this. */
export function renderWelcomeEmail(): Promise<RenderedEmail> {
  const base = Env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return renderEmail('Welcome aboard! 👋', <WelcomeEmail dashboardUrl={`${base}/dashboard`} />);
}
