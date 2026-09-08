// Single funnel for "something broke and a human should be able to find out".
//
// There is no error tracker wired up yet (SECURITY.md and the app audit both
// flag this): production failures currently surface only as a blank screen
// for the user and nothing at all for us. A real tracker needs an account and
// a DSN, which is a decision rather than a code change - so this is the seam
// that decision plugs into later. Everything that wants to report an error
// calls this, and swapping console for Sentry/Datadog becomes one edit here
// instead of a search across the codebase.
//
// Deliberately never throws: an error reporter that can itself fail turns one
// broken request into two, and the original error is the one worth keeping.

export type ErrorContext = {
  /** Where this came from, e.g. 'api/products.POST' or 'apps/orders'. */
  scope: string;
  /** Anything useful for triage. Must not contain secrets or full PII. */
  meta?: Record<string, unknown>;
};

function serialize(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'NonError', message: String(error), stack: undefined };
}

export function reportError(error: unknown, context: ErrorContext): void {
  try {
    const { name, message, stack } = serialize(error);

    // One line, one JSON object - greppable in Vercel's log drain, and
    // already the shape a log-based alert would match on.
    console.error(
      JSON.stringify({
        level: 'error',
        scope: context.scope,
        name,
        message,
        stack,
        meta: context.meta,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // Reporting must never mask the original failure.
  }
}

// What a user is allowed to see. Postgres errors name tables, columns and
// constraints, and those were being returned verbatim in API responses
// (SECURITY.md finding #12) - the detail belongs in the log above, not in a
// response body or an on-screen alert.
export function publicErrorMessage(fallback: string): string {
  return fallback;
}
