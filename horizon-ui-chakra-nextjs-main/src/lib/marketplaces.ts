// Canonical list of tracked marketplaces + their real domains. Single source
// for anything that needs both a display name and a lookup key (the logo
// slider's img.logo.dev/<domain> calls, the assistant's fact sheet). Mirrors
// scraper/src/sources/index.ts + migrations/023 - update all three together
// if a source is added or removed.
export const MARKETPLACES = [
  { name: 'PriceOye', domain: 'priceoye.pk' },
  { name: 'Telemart', domain: 'telemart.pk' },
  { name: 'Shophive', domain: 'shophive.com' },
  { name: 'iShopping', domain: 'ishopping.pk' },
  { name: 'Goto', domain: 'goto.com.pk' },
  { name: 'SapphireOnline', domain: 'sapphireonline.pk' },
  { name: 'Daraz', domain: 'daraz.pk' },
  { name: 'Mega.pk', domain: 'mega.pk' },
  { name: 'Naheed.pk', domain: 'naheed.pk' },
  { name: 'Vmart.pk', domain: 'vmart.pk' },
  { name: 'ShoppersPK', domain: 'shopperspk.com' },
];

export const MARKETPLACE_COUNT = MARKETPLACES.length;
