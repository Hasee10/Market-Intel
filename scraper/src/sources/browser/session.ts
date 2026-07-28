import { launch } from 'cloakbrowser';
import { config } from '../../config.js';

/**
 * CloakBrowser session, mirroring job-scraper's Python session.py.
 * Not used by priceoye/telemart (plain HTTP is enough for both) - this exists
 * as ready infrastructure for harder future sources like Daraz.
 */
export async function withBrowserSession<T>(fn: (browser: Awaited<ReturnType<typeof launch>>) => Promise<T>): Promise<T> {
  const options: Record<string, unknown> = {
    headless: true,
    geoip: Boolean(config.scraperProxy),
    humanize: true,
  };
  if (config.scraperProxy) options.proxy = config.scraperProxy;
  if (config.cloakbrowserLicenseKey) options.license_key = config.cloakbrowserLicenseKey;

  const browser = await launch(options as never);
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}
