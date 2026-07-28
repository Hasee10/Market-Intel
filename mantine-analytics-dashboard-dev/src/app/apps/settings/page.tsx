'use client';

import { useEffect, useState } from 'react';

import {
  Anchor,
  Badge,
  Button,
  Container,
  Grid,
  Group,
  PaperProps,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy } from '@tabler/icons-react';

import { PageHeader, Surface } from '@/components';
import { useProfile } from '@/lib/hooks/useApi';
import { PATH_DASHBOARD } from '@/routes';

const items = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Settings', href: '#' },
].map((item, index) => (
  <Anchor href={item.href} key={index}>
    {item.title}
  </Anchor>
));

const ICON_SIZE = 16;

const PAPER_PROPS: PaperProps = {
  p: 'md',
  style: { minHeight: '100%' },
};

function Settings() {
  const [saving, setSaving] = useState(false);

  const { data: profileData, loading: profileLoading, refetch } = useProfile();
  const profile = profileData?.data;

  const businessForm = useForm({
    initialValues: {
      businessName: '',
    },
  });

  const publicProfileForm = useForm({
    initialValues: {
      isPublic: false,
      displayName: '',
      showPricePosition: false,
      showRating: false,
      showCategoryRank: false,
    },
  });

  useEffect(() => {
    if (profile) {
      businessForm.setValues({ businessName: profile.businessName || '' });
      publicProfileForm.setValues({
        isPublic: profile.publicProfile?.isPublic || false,
        displayName: profile.publicProfile?.displayName || '',
        showPricePosition: profile.publicProfile?.showPricePosition || false,
        showRating: profile.publicProfile?.showRating || false,
        showCategoryRank: profile.publicProfile?.showCategoryRank || false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessForm.values.businessName,
          publicProfile: publicProfileForm.values,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update settings');
      }

      notifications.show({
        title: 'Success',
        message: 'Settings updated successfully',
        color: 'green',
      });

      refetch();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update settings',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <>
        <title>Settings | Market Intel</title>
        <meta name="description" content="Manage your account and profile settings." />
      </>
      <Container fluid>
        <Stack gap="lg">
          <PageHeader title="Settings" breadcrumbItems={items} />
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Surface {...PAPER_PROPS}>
                <Stack>
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      Business information
                    </Text>
                    {profile?.planTier && (
                      <Badge variant="light" tt="capitalize">
                        {profile.planTier} plan
                      </Badge>
                    )}
                  </Group>
                  <TextInput
                    label="Business name"
                    placeholder="Your business name"
                    {...businessForm.getInputProps('businessName')}
                  />
                  <TextInput label="Email" value={profile?.email || ''} disabled />
                </Stack>
              </Surface>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Surface {...PAPER_PROPS}>
                <Stack>
                  <div>
                    <Text size="lg" fw={600}>
                      Public profile
                    </Text>
                    <Text size="sm" c="dimmed">
                      Choose what peers can see about you in category benchmarks. Off by
                      default.
                    </Text>
                  </div>
                  <Switch
                    label="Make my profile public to peers"
                    {...publicProfileForm.getInputProps('isPublic', { type: 'checkbox' })}
                  />
                  <TextInput
                    label="Display name"
                    placeholder="Name shown to peers"
                    disabled={!publicProfileForm.values.isPublic}
                    {...publicProfileForm.getInputProps('displayName')}
                  />
                  <Switch
                    label="Show my price position"
                    disabled={!publicProfileForm.values.isPublic}
                    {...publicProfileForm.getInputProps('showPricePosition', {
                      type: 'checkbox',
                    })}
                  />
                  <Switch
                    label="Show my rating"
                    disabled={!publicProfileForm.values.isPublic}
                    {...publicProfileForm.getInputProps('showRating', { type: 'checkbox' })}
                  />
                  <Switch
                    label="Show my category rank"
                    disabled={!publicProfileForm.values.isPublic}
                    {...publicProfileForm.getInputProps('showCategoryRank', {
                      type: 'checkbox',
                    })}
                  />
                </Stack>
              </Surface>
            </Grid.Col>

            <Grid.Col span={12}>
              <Button
                leftSection={<IconDeviceFloppy size={ICON_SIZE} />}
                onClick={handleSave}
                loading={saving || profileLoading}
                style={{ width: 'fit-content' }}
              >
                Save changes
              </Button>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </>
  );
}

export default Settings;
