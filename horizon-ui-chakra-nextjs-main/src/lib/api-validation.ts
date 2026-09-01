import { NextResponse } from 'next/server';
import { z, ZodError, ZodType, ZodTypeDef } from 'zod';

// Shared body-parsing helper for API routes that previously trusted
// request.json() with manual `typeof`/`??` checks (or no check at all) -
// see products/orders/customers route.ts before this. Keeps the existing
// { succeeded, data, errors, message } response shape every route in this
// app already uses, so callers don't need any changes beyond swapping
// `await request.json()` for this.
export async function parseJsonBody<T>(
  request: Request,
  // Input pinned to `any` rather than left at its default (= T) - with the
  // default, TS has to solve Output AND Input simultaneously against T for
  // schemas like z.object() whose field-level Input/Output genuinely
  // differ (e.g. blankToNull() below), and it silently collapses to `{}`
  // for those fields instead of erroring. Decoupling Input from T fixes
  // it; confirmed necessary and sufficient with an isolated repro, not
  // just a shot in the dark.
  schema: ZodType<T, ZodTypeDef, any>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      error: NextResponse.json(
        { succeeded: false, data: null, errors: ['Request body must be valid JSON'], message: 'Invalid request body' },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: NextResponse.json(zodErrorBody(result.error), { status: 400 }) };
  }
  return { data: result.data };
}

function zodErrorBody(error: ZodError): { succeeded: false; data: null; errors: string[]; message: string } {
  const errors = error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
  return { succeeded: false, data: null, errors, message: 'Invalid request body' };
}

// Several of this app's forms always send a field with an empty-string
// initial value (never omit it) - products/orders/customers all previously
// relied on `body.field || null` or `body.field || 'default'` to treat that
// blank string as "not provided". A plain `z.string().min(1)` would instead
// reject the blank string as too short, breaking the legitimate "left
// empty" case. Pass the base string schema (without .nullish() - this adds
// it) - blankToNull(z.string().trim().min(1)) - blank/whitespace-only input
// becomes null before the real string validation runs, so it keeps the
// original falsy-fallback behavior while still validating real content
// (format, length, etc.) when something is actually sent.
//
// Explicit return type rather than relying on inference through
// z.preprocess()'s own generics: constrained to z.ZodString on purpose
// (every current use wraps a plain string schema) so this stays simple
// instead of fighting zod's preprocess typing for a fully generic input.
export function blankToNull<S extends z.ZodString>(schema: S): ZodType<z.infer<S> | null | undefined, ZodTypeDef, unknown> {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullish()) as unknown as ZodType<
    z.infer<S> | null | undefined,
    ZodTypeDef,
    unknown
  >;
}
