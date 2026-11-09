import * as Sentry from '@sentry/node';

// Error tracking only (no tracing: t3.micro has no CPU to spare).
// No SENTRY_DSN = no-op, so dev and tests are unaffected.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export default Sentry;
