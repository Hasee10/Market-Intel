// Stands in for the `server-only` package under vitest.
//
// Most lib files here write `'server-only';` as a bare expression statement,
// which is a no-op marker - it documents intent and enforces nothing. A few
// files (lib/mobile/respond.ts) use the real `import 'server-only'`, which
// Next resolves through its own alias at build time and genuinely fails the
// build if the module is pulled into a Client Component.
//
// That real form is worth keeping, but the package itself is not a
// dependency, so vitest cannot resolve it and every test that reaches such a
// file dies at import. Aliasing it here (see vitest.config.ts) keeps the
// build-time guarantee and lets route handlers be unit tested - rather than
// downgrading the import to the marker, which would trade a real check for a
// comment.
export {};
