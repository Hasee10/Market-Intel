import { describe, it, expect } from 'vitest';

import { checkCrossSite } from './csrf';

// Each case is one line of the policy. The ones that must PASS matter as
// much as the ones that must block: the mobile app and the cron workflow
// both send Bearer and no cookie, and a native client sends no Origin -
// refusing any of those would take down a working integration to close an
// Info-severity finding.

function req(method: string, headers: Record<string, string> = {}, host = 'app.example.com') {
  const h = new Headers(headers);
  return { method, headers: h, nextUrl: { host } };
}

describe('checkCrossSite', () => {
  it('ignores reads entirely', () => {
    expect(checkCrossSite(req('GET', { 'sec-fetch-site': 'cross-site' })).blocked).toBe(false);
  });

  it('blocks a cross-site mutation by fetch metadata', () => {
    const v = checkCrossSite(req('POST', { 'sec-fetch-site': 'cross-site' }));
    expect(v.blocked).toBe(true);
  });

  it('allows same-origin, same-site, and user-initiated (none)', () => {
    for (const site of ['same-origin', 'same-site', 'none']) {
      expect(checkCrossSite(req('POST', { 'sec-fetch-site': site })).blocked).toBe(false);
    }
  });

  it('falls back to Origin when there is no fetch metadata, and matches on host', () => {
    expect(checkCrossSite(req('PUT', { origin: 'https://app.example.com' })).blocked).toBe(false);
    expect(checkCrossSite(req('PUT', { origin: 'https://evil.example' })).blocked).toBe(true);
  });

  it('never blocks a request that carries a Bearer token - mobile and cron have no cookie to forge', () => {
    const v = checkCrossSite(
      req('DELETE', { authorization: 'Bearer tok', 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }),
    );
    expect(v.blocked).toBe(false);
  });

  it('allows a non-browser client that sends neither fetch metadata nor Origin', () => {
    expect(checkCrossSite(req('POST')).blocked).toBe(false);
  });

  it('prefers fetch metadata over Origin when both are present', () => {
    // A spoofed Origin cannot override what the browser says about the site.
    const v = checkCrossSite(req('POST', { 'sec-fetch-site': 'cross-site', origin: 'https://app.example.com' }));
    expect(v.blocked).toBe(true);
  });

  it('blocks an unparseable Origin rather than letting it through', () => {
    expect(checkCrossSite(req('POST', { origin: 'not a url' })).blocked).toBe(true);
  });
});
