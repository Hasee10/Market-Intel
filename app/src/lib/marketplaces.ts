// Canonical list of tracked marketplaces + their real domains. Single source
// for anything that needs both a display name and a lookup key (the logo
// slider's img.logo.dev/<domain> calls, the assistant's fact sheet). Mirrors
// scraper/src/sources/index.ts + its migration platform-registration files
// (023, 032-034, 037-039) - update all of these together if a source is
// added or removed.
//
// Names are copied verbatim from each migration's `insert into
// market_platforms` row, not re-typed - that keeps this list matching the
// same display name already shown everywhere else in the app (competitor
// scorecards' platform_name, the scraper-health page), rather than drifting
// into a second, slightly different spelling.
//
// Fixed 2026-08-29 (code audit): this list held the original 11 sources
// only, three source-addition batches after the fact (45 sources across
// six PRs on 2026-08-29 alone) - so every marketing surface reading
// MARKETPLACE_COUNT from here was understating real coverage by 45, and the
// assistant's fact sheet was telling sellers in categories those batches
// were specifically added to cover (automotive, sports & outdoors, pet
// supplies, coffee, health & wellness, furniture) that Ryvl didn't track
// them.
export const MARKETPLACES = [
  { name: 'PriceOye.pk', domain: 'priceoye.pk' },
  { name: 'Telemart.pk', domain: 'telemart.pk' },
  { name: 'Shophive', domain: 'shophive.com' },
  { name: 'iShopping.pk', domain: 'ishopping.pk' },
  { name: 'Goto.com.pk', domain: 'goto.com.pk' },
  { name: 'Sapphire Online', domain: 'sapphireonline.pk' },
  { name: 'Daraz', domain: 'daraz.pk' },
  { name: 'Mega.pk', domain: 'mega.pk' },
  { name: 'Naheed.pk', domain: 'naheed.pk' },
  { name: 'Vmart.pk', domain: 'vmart.pk' },
  { name: 'ShoppersPK', domain: 'shopperspk.com' },
  { name: 'Bagallery', domain: 'bagallery.com' },
  { name: 'J. (Junaid Jamshed)', domain: 'junaidjamshed.com' },
  { name: 'Gul Ahmed (Ideas)', domain: 'gulahmedshop.com' },
  { name: 'Chase Value', domain: 'chasevalue.pk' },
  { name: 'Al-Fatah', domain: 'alfatah.pk' },
  { name: 'Springs', domain: 'springs.com.pk' },
  { name: 'Outfitters', domain: 'outfitters.com.pk' },
  { name: 'SEW Markaz', domain: 'sewmarkaz.com' },
  { name: 'Petshub.pk', domain: 'petshub.pk' },
  { name: 'Zellbury', domain: 'zellbury.com' },
  { name: 'Bonanza Satrangi', domain: 'bonanzasatrangi.com' },
  { name: 'Beechtree', domain: 'beechtree.pk' },
  { name: 'Nishat Linen', domain: 'nishatlinen.com' },
  { name: 'Interwood', domain: 'interwood.pk' },
  { name: 'Habitt', domain: 'habitt.com' },
  { name: 'Poshish', domain: 'poshish.pk' },
  { name: 'Woods.pk', domain: 'woods.pk' },
  { name: 'ChenOne', domain: 'chenone.com' },
  { name: 'PetFit.pk', domain: 'petfit.pk' },
  { name: 'Luminaria.pk', domain: 'luminaria.pk' },
  { name: 'Ali Sports', domain: 'alisports.pk' },
  { name: 'Bodybrics', domain: 'bodybrics.com' },
  { name: 'Hustlers Only PK', domain: 'hustlersonlypk.com' },
  { name: 'Activity Sphere', domain: 'activitysphere.pk' },
  { name: 'Zeesol Store', domain: 'zeesol.net' },
  { name: 'BlingSpot.pk', domain: 'blingspot.pk' },
  { name: 'Katib.pk', domain: 'katib.pk' },
  { name: 'Mercury Stationery', domain: 'mercurystationery.com' },
  { name: 'Stationery.pk', domain: 'stationary.pk' },
  { name: 'Assany.pk', domain: 'assany.pk' },
  { name: 'SehgalMotors.pk', domain: 'sehgalmotors.pk' },
  { name: 'AsadAutos.pk', domain: 'asadautos.pk' },
  { name: 'PakistanMotors.pk', domain: 'pakistanmotors.pk' },
  { name: 'PremiumExo', domain: 'premiumexo.com' },
  { name: 'Autostore.pk', domain: 'autostore.pk' },
  { name: 'Coffee Crest', domain: 'coffeecrest.pk' },
  { name: 'Snapcart.pk', domain: 'snapcart.pk' },
  { name: 'Well Pakistan', domain: 'wellpakistan.com' },
  { name: 'My Vitamin Store', domain: 'myvitaminstore.pk' },
  { name: 'Ginnastic Nutrition', domain: 'ginnasticnutrition.com' },
  { name: 'Pet Master', domain: 'petmaster.pk' },
  { name: 'PetsPark.pk', domain: 'petspark.pk' },
  { name: 'ePetStore.pk', domain: 'epetstore.pk' },
  { name: 'SCAFE Coffee Roaster', domain: 'scafe.pk' },
  { name: 'Red Berry Roasters', domain: 'redberryroasters.com' },
];

export const MARKETPLACE_COUNT = MARKETPLACES.length;
