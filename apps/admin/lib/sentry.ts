// Sentry shim — no-op until @sentry/node is installed and SENTRY_DSN is set.
// Wire in production by adding `@sentry/node` to apps/admin/package.json and
// importing { init } from there inside this function. Kept dep-free in the
// pilot so unconfigured deploys don't break.

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  if (!process.env.SENTRY_DSN) return;
  // intentional no-op stub
}
