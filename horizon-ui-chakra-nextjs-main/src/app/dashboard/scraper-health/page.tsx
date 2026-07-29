import { getScraperHealth } from '@/lib/market-intel/scraper-health';

import ScraperHealthView from './ScraperHealthView';

async function Page() {
  const platforms = await getScraperHealth();

  return (
    <>
      <title>Data Health | Market Intel</title>
      <meta name="description" content="Scraper reliability per competitor data source." />
      <ScraperHealthView platforms={platforms} />
    </>
  );
}

export default Page;
