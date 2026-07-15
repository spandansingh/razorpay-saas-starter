'use client';

import type { PropsWithChildren } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { DEFAULT_POSTHOG_HOST } from '@/libs/analytics';
import { Env } from '@/libs/Env';

// Client-side PostHog. The locale layout only renders this component when
// NEXT_PUBLIC_POSTHOG_KEY is set, so nothing ships otherwise. init() is
// idempotent and runs once on mount.
export function PostHogProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const key = Env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return;
    }
    posthog.init(key, {
      api_host: Env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
      person_profiles: 'identified_only',
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
