'use client';

import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  Input,
  InputGroup,
  InputLeftAddon,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import Card from 'components/card/Card';
import { MarketScopeBanner } from '@/components/marketintel/MarketScopeBanner';
import { PageHeader } from '@/components/marketintel/PageHeader';
import type {
  MarketDefinition,
  MarketScopeCoverage,
  MarketScopeSummary,
  MarketSegment,
  TaxonomyPlatform,
} from '@/lib/market-intel/market/market-definition';
import { PATH_DASHBOARD } from '@/lib/paths';

import { saveMarketDefinitionAction } from './actions';

type Props = {
  categorySlug: string;
  categoryName: string;
  reportingCurrency: string;
  definition: MarketDefinition;
  allSegments: MarketSegment[];
  platforms: TaxonomyPlatform[];
  coverage: MarketScopeCoverage;
  summary: MarketScopeSummary;
};

// A free-text list (brands, cities) entered as chips. Kept deliberately dumb -
// brands are matched case-insensitively against market_products.brand, so
// there is no canonical list to offer as a dropdown yet. When D2 enriches the
// sources with a real brand dimension this can become a picker.
function ChipInput({
  label,
  helper,
  placeholder,
  values,
  onChange,
  isDisabled = false,
}: {
  label: string;
  helper: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  /** For a filter that provably cannot narrow anything - see the Cities usage. */
  isDisabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value]);
    setDraft('');
  };

  return (
    <FormControl isDisabled={isDisabled}>
      <FormLabel fontSize="sm" fontWeight="600" mb="4px">
        {label}
      </FormLabel>
      <Input
        size="md"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
      <FormHelperText fontSize="xs">{helper}</FormHelperText>
      {values.length > 0 && (
        <Flex wrap="wrap" gap="6px" mt="8px">
          {values.map((value) => (
            <Tag key={value} size="sm" colorScheme="brand" borderRadius="full">
              <TagLabel>{value}</TagLabel>
              <TagCloseButton onClick={() => onChange(values.filter((v) => v !== value))} />
            </Tag>
          ))}
        </Flex>
      )}
    </FormControl>
  );
}

export default function MarketDefinitionEditor({
  categorySlug,
  categoryName,
  reportingCurrency,
  definition,
  allSegments,
  platforms,
  coverage,
  summary,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');

  // An empty `includedSegments` means "all" in the database (see migration
  // 020). The editor expands that to every checkbox ticked, so the seller sees
  // what is actually in scope rather than an empty form that reads as "none".
  const [segments, setSegments] = useState<string[]>(
    definition.includedSegments.length > 0 ? definition.includedSegments : allSegments.map((s) => s.slug),
  );
  const [excludedPlatforms, setExcludedPlatforms] = useState<string[]>(definition.excludedPlatformIds);
  const [priceMin, setPriceMin] = useState(definition.priceMin != null ? String(definition.priceMin) : '');
  const [priceMax, setPriceMax] = useState(definition.priceMax != null ? String(definition.priceMax) : '');
  const [brands, setBrands] = useState<string[]>(definition.brands);
  const [cities, setCities] = useState<string[]>(definition.cities);
  const [error, setError] = useState<string | null>(null);

  const priceCurrency = definition.isDefault ? reportingCurrency : definition.priceCurrency;

  const noSegmentsSelected = allSegments.length > 0 && segments.length === 0;
  const dirty = useMemo(() => {
    const savedSegments =
      definition.includedSegments.length > 0 ? definition.includedSegments : allSegments.map((s) => s.slug);
    const same = (a: string[], b: string[]) =>
      a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
    return (
      !same(savedSegments, segments) ||
      !same(definition.excludedPlatformIds, excludedPlatforms) ||
      (definition.priceMin != null ? String(definition.priceMin) : '') !== priceMin ||
      (definition.priceMax != null ? String(definition.priceMax) : '') !== priceMax ||
      !same(definition.brands, brands) ||
      !same(definition.cities, cities)
    );
  }, [definition, allSegments, segments, excludedPlatforms, priceMin, priceMax, brands, cities]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const onSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const result = await saveMarketDefinitionAction({
        sellerCategorySlug: categorySlug,
        includedSegments: segments,
        excludedPlatformIds: excludedPlatforms,
        priceMin: priceMin || null,
        priceMax: priceMax || null,
        priceCurrency,
        brands,
        cities,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not save your market definition.');
        return;
      }

      toast({
        title: 'Market definition saved',
        description: 'Every figure on your analysis pages now uses this scope.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Market Definition"
        breadcrumbItems={[
          { title: 'Market', href: PATH_DASHBOARD.market },
          { title: 'Definition', href: PATH_DASHBOARD.marketDefinition },
        ]}
        actionButton={
          <Button variant="brand" onClick={onSave} isLoading={isSaving} isDisabled={!dirty || noSegmentsSelected}>
            Save definition
          </Button>
        }
      />

      <MarketScopeBanner summary={summary} />

      {error && (
        <Alert status="error" borderRadius="12px" mb="20px">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {noSegmentsSelected && (
        <Alert status="warning" borderRadius="12px" mb="20px">
          <AlertIcon />
          Select at least one segment — a market with nothing in it produces no analysis.
        </Alert>
      )}

      {allSegments.length === 0 ? (
        <Card p="24px">
          <Text fontWeight="700" color={textColor} mb="6px">
            No scraped coverage for {categoryName} yet
          </Text>
          <Text fontSize="sm" color={mutedColor}>
            No source we scrape carries this category, so there is nothing to define a market over. This is a
            data-coverage gap rather than a setting — the honest answer is that we cannot analyse this market today,
            not a dashboard full of zeroes presented as findings.
          </Text>
        </Card>
      ) : (
        /* alignItems="start" so each column is only as tall as its own
           content. Grid's default `stretch` made the left card match the
           three stacked cards on the right, which on a category with one
           segment and eight platforms left roughly 300px of empty card
           below the last checkbox. */
        <Grid templateColumns={{ base: '1fr', lg: '1.15fr 1fr' }} gap="20px" alignItems="start">
          <Card p="24px">
            <Text fontWeight="700" color={textColor} mb="4px">
              What you sell
            </Text>
            {/* The plural copy ("They are not one market... turn off the ones
                you do not compete in") is nonsense at one segment, where the
                only two states are "on" and the blocking empty-market warning.
                Say what is actually true instead of pluralising a noun inside
                a sentence that stays plural either way. */}
            <Text fontSize="sm" color={mutedColor} mb="16px">
              {allSegments.length === 1 ? (
                <>
                  {categoryName} resolves to a single segment in the data we scrape, so there is nothing to narrow
                  here yet — unticking it leaves your market empty. It stays visible because coverage grows: as we map
                  more of this category, the new segments appear here for you to opt out of.
                </>
              ) : (
                <>
                  {categoryName} spans {allSegments.length} distinct segments in the data we scrape. They are not one
                  market: leaving them all on means your median is computed across every one of them. Turn off the
                  ones you do not compete in.
                </>
              )}
            </Text>

            <Flex direction="column" gap="12px">
              {allSegments.map((segment) => (
                <Flex key={segment.slug} align="flex-start" gap="10px">
                  <Checkbox
                    isChecked={segments.includes(segment.slug)}
                    onChange={() => setSegments(toggle(segments, segment.slug))}
                    mt="2px"
                  />
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color={textColor}>
                      {segment.label}
                    </Text>
                    <Text fontSize="xs" color={mutedColor}>
                      {segment.platformNames.join(', ')}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>

            <Box mt="24px">
              <Text fontWeight="700" color={textColor} mb="4px">
                Where you compete
              </Text>
              <Text fontSize="sm" color={mutedColor} mb="12px">
                Untick a platform to drop it from every comparison. Platforms added later are included automatically —
                this is an opt-out, so your market widens as our coverage does.
              </Text>
              <Flex wrap="wrap" gap="16px">
                {platforms.map((platform) => (
                  <Checkbox
                    key={platform.id}
                    isChecked={!excludedPlatforms.includes(platform.id)}
                    onChange={() => setExcludedPlatforms(toggle(excludedPlatforms, platform.id))}
                  >
                    <Text fontSize="sm">{platform.name}</Text>
                  </Checkbox>
                ))}
              </Flex>
            </Box>
          </Card>

          <Flex direction="column" gap="20px">
            <Card p="24px">
              <Text fontWeight="700" color={textColor} mb="4px">
                Price band
              </Text>
              <Text fontSize="sm" color={mutedColor} mb="16px">
                The single biggest source of a misleading median. Leave blank for no bound. Entered in {priceCurrency};
                scraped listings are converted before comparison.
              </Text>
              <Grid templateColumns="1fr 1fr" gap="12px">
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" mb="4px">
                    Minimum
                  </FormLabel>
                  <InputGroup>
                    <InputLeftAddon fontSize="sm">{priceCurrency}</InputLeftAddon>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Any"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" mb="4px">
                    Maximum
                  </FormLabel>
                  <InputGroup>
                    <InputLeftAddon fontSize="sm">{priceCurrency}</InputLeftAddon>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Any"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                    />
                  </InputGroup>
                </FormControl>
              </Grid>
            </Card>

            <Card p="24px">
              <Flex direction="column" gap="20px">
                <ChipInput
                  label="Brands"
                  helper="Leave empty to include every brand. Press Enter to add."
                  placeholder="e.g. Samsung"
                  values={brands}
                  onChange={setBrands}
                />
                {/* Only classifieds carry a location, so with zero classified
                    listings in scope this filter has nothing it could ever
                    exclude - an input that silently does nothing is worse
                    than one that says why. Guarded on cities.length so a
                    seller whose own city filter is what emptied the classified
                    count can still edit their way back out of it. */}
                <ChipInput
                  label="Cities"
                  isDisabled={cities.length === 0 && coverage.listingCount === 0}
                  helper={
                    cities.length === 0 && coverage.listingCount === 0
                      ? 'No classified listings in your market, so a city filter has nothing to narrow. Only classifieds carry a location; retailer listings never do.'
                      : 'Classifieds only — retailer listings have no location and are never excluded by this.'
                  }
                  placeholder="e.g. Karachi"
                  values={cities}
                  onChange={setCities}
                />
              </Flex>
            </Card>

            <Card p="24px">
              <Text fontWeight="700" color={textColor} mb="10px">
                Currently in scope
              </Text>
              <Flex gap="8px" wrap="wrap" mb="10px">
                <Badge colorScheme="brand" variant="subtle" fontSize="11px" textTransform="none">
                  {coverage.productCount.toLocaleString()} retailer products
                </Badge>
                <Badge colorScheme="purple" variant="subtle" fontSize="11px" textTransform="none">
                  {coverage.listingCount.toLocaleString()} classified listings
                </Badge>
              </Flex>
              <Text fontSize="xs" color={mutedColor}>
                {coverage.platformNames.length > 0
                  ? `Across ${coverage.platformNames.join(', ')}. Counts refresh after you save.`
                  : 'No platforms currently return rows for this scope. Counts refresh after you save.'}
              </Text>
            </Card>
          </Flex>
        </Grid>
      )}
    </Box>
  );
}
