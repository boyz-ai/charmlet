// Anonymous product analytics: which levels players reach, where they stop, whether they come back.
// No names, no ad ID, no session recordings. Off while ANALYTICS.key is empty.
import { ANALYTICS } from '../config';

type Props = Record<string, string | number | boolean>;
interface Client { capture(event: string, props?: Props): void }

let client: Client | null = null;
const queue: [string, Props][] = [];

export async function startAnalytics(): Promise<void> {
  if (!ANALYTICS.key || client) return;
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(ANALYTICS.key, {
      api_host: ANALYTICS.host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      persistence: 'localStorage',
      person_profiles: 'always',
    });
    client = posthog as unknown as Client;
    for (const [e, p] of queue.splice(0)) client.capture(e, p);
  } catch { /* analytics must never break the game */ }
}

export function track(event: string, props: Props = {}): void {
  if (!ANALYTICS.key) return;
  try {
    if (client) client.capture(event, props);
    else if (queue.length < 50) queue.push([event, props]);
  } catch { /* ignore */ }
}
