'use client';

import { useEffect, useState } from 'react';

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
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { ReferralCard } from '@/components/marketintel/ReferralCard';
import { useProfile } from '@/lib/hooks/useApi';
import { PATH_DASHBOARD } from '@/lib/paths';
import { SUPPORTED_CURRENCIES } from '@/types/products';

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Settings', href: '#' },
];

export default function SettingsPage() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const { data: profileData, loading: profileLoading, refetch } = useProfile();
  const profile = profileData?.data;
  const authFailed = !profileLoading && profileData && profileData.succeeded === false;

  const [businessName, setBusinessName] = useState('');
  const [reportingCurrency, setReportingCurrency] = useState('PKR');
  const [isPublic, setIsPublic] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [showPricePosition, setShowPricePosition] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showCategoryRank, setShowCategoryRank] = useState(false);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.businessName || '');
      setReportingCurrency(profile.reportingCurrency || 'PKR');
      setIsPublic(profile.publicProfile?.isPublic || false);
      setDisplayName(profile.publicProfile?.displayName || '');
      setShowPricePosition(profile.publicProfile?.showPricePosition || false);
      setShowRating(profile.publicProfile?.showRating || false);
      setShowCategoryRank(profile.publicProfile?.showCategoryRank || false);
    }
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
          publicProfile: {
            isPublic,
            displayName,
            showPricePosition,
            showRating,
            showCategoryRank,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update settings');
      }

      toast({ title: 'Success', description: 'Settings updated successfully', status: 'success' });
      refetch();
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

  if (authFailed) {
    return (
      <ErrorAlert
        title="Error loading settings"
        message={profileData?.errors?.join(', ') || 'Not authenticated'}
      />
    );
  }

  return (
    <>
      <PageHeader title="Settings" breadcrumbItems={breadcrumbItems} />
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="20px">
        <Card>
          <Flex justify="space-between" align="center" mb="16px">
            <Text fontSize="lg" fontWeight="600">
              Business information
            </Text>
            {profile?.planTier && (
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
            <Input value={profile?.email || ''} isDisabled />
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

        <DomainsManager />
        <ReferralCard />
      </Grid>

      <Button
        leftIcon={<MdSave />}
        variant="brand"
        onClick={handleSave}
        isLoading={saving || profileLoading}
        mt="20px"
      >
        Save changes
      </Button>
    </>
  );
}
