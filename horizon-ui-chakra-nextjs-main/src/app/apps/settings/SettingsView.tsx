'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Select,
  Switch,
  Text,
  useToast,
} from '@chakra-ui/react';
import { MdSave } from 'react-icons/md';

import Card from 'components/card/Card';

import { DomainsManager } from '@/components/marketintel/DomainsManager';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { ReferralCard } from '@/components/marketintel/ReferralCard';
import { PATH_DASHBOARD } from '@/lib/paths';
import type { SellerProfile } from '@/lib/market-intel/seller/settings';
import type { SellerDomainRow } from '@/lib/market-intel/seller/seller';
import type { ReferralStats } from '@/lib/market-intel/seller/referrals';
import { SUPPORTED_CURRENCIES } from '@/types/products';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/core/countries';

// Pure rendering - profile arrives as a prop from page.tsx's server fetch.
// This used to run useProfile() (a client GET on load) itself; see
// apps/orders/page.tsx for the pattern this follows. The PUT save below is a
// real mutation triggered by user action, so it stays a plain client fetch -
// only the initial load moved server-side. No isLoaded/Skeleton branch is
// needed any more either: the form never renders before real data exists.

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Settings', href: '#' },
];

type SettingsViewProps = {
  profile: SellerProfile;
  domains: SellerDomainRow[];
  categories: { id: string; slug: string; name: string }[];
  referral: ReferralStats | null;
};

export default function SettingsView({
  profile,
  domains,
  categories,
  referral,
}: SettingsViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState(profile.businessName || '');
  const [reportingCurrency, setReportingCurrency] = useState(profile.reportingCurrency || 'PKR');
  const [country, setCountry] = useState(profile.country || 'PK');
  const [isPublic, setIsPublic] = useState(profile.publicProfile?.isPublic || false);
  const [displayName, setDisplayName] = useState(profile.publicProfile?.displayName || '');
  const [showPricePosition, setShowPricePosition] = useState(profile.publicProfile?.showPricePosition || false);
  const [showRating, setShowRating] = useState(profile.publicProfile?.showRating || false);
  const [showCategoryRank, setShowCategoryRank] = useState(profile.publicProfile?.showCategoryRank || false);
  const [website, setWebsite] = useState(profile.publicProfile?.website || '');
  const [showOnMarketingSite, setShowOnMarketingSite] = useState(
    profile.publicProfile?.showOnMarketingSite || false,
  );

  // Re-syncs local form state whenever `profile` changes - i.e. after
  // router.refresh() following a successful save. The original synced from
  // useProfile()'s refetch() the same way: the PUT response can normalize
  // values (e.g. a trimmed businessName), and the form should reflect what
  // was actually persisted, not just what was typed.
  useEffect(() => {
    setBusinessName(profile.businessName || '');
    setReportingCurrency(profile.reportingCurrency || 'PKR');
    setCountry(profile.country || 'PK');
    setIsPublic(profile.publicProfile?.isPublic || false);
    setDisplayName(profile.publicProfile?.displayName || '');
    setShowPricePosition(profile.publicProfile?.showPricePosition || false);
    setShowRating(profile.publicProfile?.showRating || false);
    setShowCategoryRank(profile.publicProfile?.showCategoryRank || false);
    setWebsite(profile.publicProfile?.website || '');
    setShowOnMarketingSite(profile.publicProfile?.showOnMarketingSite || false);
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          reportingCurrency,
          country,
          publicProfile: {
            isPublic,
            displayName,
            showPricePosition,
            showRating,
            showCategoryRank,
            website,
            showOnMarketingSite,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update settings');
      }

      toast({ title: 'Success', description: 'Settings updated successfully', status: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update settings',
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" breadcrumbItems={breadcrumbItems} />
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="20px">
        <Card>
          <Flex justify="space-between" align="center" mb="16px">
            <Text fontSize="lg" fontWeight="600">
              Business information
            </Text>
            {profile.planTier && (
              <Badge colorScheme="brand" textTransform="capitalize">
                {profile.planTier} plan
              </Badge>
            )}
          </Flex>
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Business name
            </FormLabel>
            <Input
              placeholder="Your business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </FormControl>
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Email
            </FormLabel>
            <Input value={profile.email || ''} isDisabled />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm" fontWeight="500">
              Reporting currency
            </FormLabel>
            <Text fontSize="xs" color="secondaryGray.600" mb="6px">
              Orders, products, and customers can each be in their own currency - dashboard totals and
              the PPTX report convert everything into this one currency before adding them up.
            </Text>
            <Select value={reportingCurrency} onChange={(e) => setReportingCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl mt="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Country
            </FormLabel>
            <Text fontSize="xs" color="secondaryGray.600" mb="6px">
              Adjusts which product fields (like SKU) are required when adding or importing products,
              so you&apos;re never forced to fill in something your market doesn&apos;t use.
            </Text>
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormControl>
        </Card>

        <Card>
          <Text fontSize="lg" fontWeight="600" mb="4px">
            Public profile
          </Text>
          <Text fontSize="sm" color="secondaryGray.600" mb="16px">
            Choose what peers can see about you in category benchmarks. Off by default.
          </Text>
          <Flex align="center" justify="space-between" mb="12px">
            <FormLabel mb="0" fontSize="sm" fontWeight="500">
              Make my profile public to peers
            </FormLabel>
            <Switch
              isChecked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              colorScheme="brand"
            />
          </Flex>
          <FormControl mb="12px">
            <FormLabel fontSize="sm" fontWeight="500">
              Display name
            </FormLabel>
            <Input
              placeholder="Name shown to peers"
              isDisabled={!isPublic}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </FormControl>
          <Flex align="center" justify="space-between" mb="8px">
            <FormLabel mb="0" fontSize="sm" fontWeight="500">
              Show my price position
            </FormLabel>
            <Switch
              isChecked={showPricePosition}
              isDisabled={!isPublic}
              onChange={(e) => setShowPricePosition(e.target.checked)}
              colorScheme="brand"
            />
          </Flex>
          <Flex align="center" justify="space-between" mb="8px">
            <FormLabel mb="0" fontSize="sm" fontWeight="500">
              Show my rating
            </FormLabel>
            <Switch
              isChecked={showRating}
              isDisabled={!isPublic}
              onChange={(e) => setShowRating(e.target.checked)}
              colorScheme="brand"
            />
          </Flex>
          <Flex align="center" justify="space-between">
            <FormLabel mb="0" fontSize="sm" fontWeight="500">
              Show my category rank
            </FormLabel>
            <Switch
              isChecked={showCategoryRank}
              isDisabled={!isPublic}
              onChange={(e) => setShowCategoryRank(e.target.checked)}
              colorScheme="brand"
            />
          </Flex>
        </Card>

        <Card>
          <Text fontSize="lg" fontWeight="600" mb="4px">
            Marketing site showcase
          </Text>
          <Text fontSize="sm" color="secondaryGray.600" mb="16px">
            Separate from peer benchmarking above - this shows your logo to anonymous visitors on
            ryvl&apos;s public homepage, not just other sellers. Off by default.
          </Text>
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Website
            </FormLabel>
            <Input
              placeholder="yourstore.pk"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </FormControl>
          <Flex align="center" justify="space-between">
            <FormLabel mb="0" fontSize="sm" fontWeight="500">
              Show my logo on the Ryvl homepage
            </FormLabel>
            <Switch
              isChecked={showOnMarketingSite}
              isDisabled={!website.trim()}
              onChange={(e) => setShowOnMarketingSite(e.target.checked)}
              colorScheme="brand"
            />
          </Flex>
        </Card>

        {/* Both used to fetch for themselves; their data now comes from
            page.tsx's single server pass. */}
        <DomainsManager domains={domains} categories={categories} />
        <ReferralCard stats={referral} />
      </Grid>

      <Button leftIcon={<MdSave />} variant="brand" onClick={handleSave} isLoading={saving} mt="20px">
        Save changes
      </Button>
    </>
  );
}
