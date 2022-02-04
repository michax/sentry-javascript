import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://public@dsn.ingest.sentry.io/1337',
  release: '1.0',
});

Sentry.captureMessage('debug_message', 'debug' as Sentry.Severity);
Sentry.captureMessage('info_message', 'info' as Sentry.Severity);
Sentry.captureMessage('warning_message', 'warning' as Sentry.Severity);
Sentry.captureMessage('error_message', 'error' as Sentry.Severity);
Sentry.captureMessage('fatal_message', 'fatal' as Sentry.Severity);
Sentry.captureMessage('critical_message', 'critical' as Sentry.Severity);
Sentry.captureMessage('log_message', 'log' as Sentry.Severity);
