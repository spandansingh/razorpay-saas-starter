import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { AppConfig } from '@/utils/AppConfig';

// Email clients understand neither CSS variables nor oklch(), so the app's
// design tokens are mirrored here as hex. These are the same values as
// src/styles/global.css — Tailwind's neutral scale:
//   --foreground        oklch(0.145 0 0)  neutral-950
//   --primary           oklch(0.205 0 0)  neutral-900
//   --muted-foreground  oklch(0.556 0 0)  neutral-500
//   --border            oklch(0.922 0 0)  neutral-200
// Keep them in step when the tokens change.
export const emailTheme = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  primary: '#171717',
  primaryForeground: '#fafafa',
  mutedForeground: '#737373',
  border: '#e5e5e5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

type Props = {
  /** Inbox preview line. Falls back to the client showing the opening copy. */
  preview: string;
  children: React.ReactNode;
};

export const EmailLayout = ({ preview, children }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{preview}</Preview>
    <Body
      style={{
        backgroundColor: '#f5f5f5',
        fontFamily: emailTheme.fontFamily,
        margin: 0,
        padding: '24px 0',
      }}
    >
      <Container
        style={{
          backgroundColor: emailTheme.background,
          border: `1px solid ${emailTheme.border}`,
          borderRadius: '8px',
          margin: '0 auto',
          maxWidth: '560px',
          padding: '32px',
        }}
      >
        <Section>
          <Text
            style={{
              color: emailTheme.foreground,
              fontSize: '20px',
              fontWeight: 700,
              margin: '0 0 24px',
            }}
          >
            {AppConfig.name}
          </Text>
        </Section>

        {children}

        <Hr style={{ borderColor: emailTheme.border, margin: '32px 0 16px' }} />

        <Text style={{ color: emailTheme.mutedForeground, fontSize: '12px', margin: 0 }}>
          {AppConfig.name}
          {' · '}
          Questions? Reach us at
          {' '}
          {AppConfig.email.support}
        </Text>
      </Container>
    </Body>
  </Html>
);
