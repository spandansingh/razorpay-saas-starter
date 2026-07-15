import { PostHog } from 'posthog-node';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export type CaptureInput = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
};

// One server client, lazily built. Unconfigured → null, and capture() is a
// silent no-op. The client-side provider lives in PostHogProvider.tsx.
let client: PostHog | null = null;
function getClient(): PostHog | null {
  if (!Env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }
  if (!client) {
    client = new PostHog(Env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: Env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    });
  }
  return client;
}

// Plug-and-play: with no NEXT_PUBLIC_POSTHOG_KEY, capture() returns immediately
// so the app never blocks on analytics. flush() is awaited so events survive a
// short-lived serverless invocation.
//
// Never throws. Callers sit on the payment webhook path, where an unreachable
// PostHog must not 500 the route and trigger a provider retry — a dropped
// analytics event is always cheaper than a delayed fulfillment.
export async function capture(input: CaptureInput): Promise<void> {
  const posthog = getClient();
  if (!posthog) {
    return;
  }
  try {
    posthog.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
    });
    await posthog.flush();
  } catch (error) {
    logger.error(`analytics capture failed ("${input.event}"): ${error instanceof Error ? error.message : String(error)}`);
  }
}
