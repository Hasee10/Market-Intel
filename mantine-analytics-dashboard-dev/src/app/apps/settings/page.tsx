'use client';

import { useEffect, useState } from 'react';

import {
  Anchor,
  Avatar,
  Box,
  Button,
  Container,
  FileButton,
  Grid,
  Group,
  PaperProps,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCloudUpload, IconDeviceFloppy } from '@tabler/icons-react';

import { PageHeader, Surface, TextEditor } from '@/components';
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

const BIO = '';

function Settings() {
  const [file, setFile] = useState<File | null>(null);

  const {
    data: profileData,
    loading: profileLoading,
  } = useProfile();

  const profile = profileData?.data;

  const accountForm = useForm({
    initialValues: {
      username: profile?.name || '',
      biograghy: BIO,
    },
  });

  const accountInfoForm = useForm({
    initialValues: {
      email: profile?.email || '',
      phoneNumber: '',
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email is required';
        return /^\S+@\S+$/.test(value) ? null : 'Invalid email';
      },
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      accountForm.setValues({
        username: profile.name || '',
        biograghy: BIO,
      });
      accountInfoForm.setValues({
        email: profile.email || '',
        phoneNumber: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleSaveAccountInfo = async () => {
    try {
      // Note: In this mock template, profile data is read-only from JSON files
      // For a real implementation, you would send a PUT request here
      notifications.show({
        title: 'Success',
        message: 'Profile updated successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update profile',
        color: 'red',
      });
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
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Surface {...PAPER_PROPS}>
                <Text size="lg" fw={600} mb="md">
                  User information
                </Text>
                <Grid gutter={{ base: 5, xs: 'md', md: 'md', lg: 'lg' }}>
                  <Grid.Col span={{ base: 12, md: 6, lg: 9, xl: 9 }}>
                    <Stack>
                      <TextInput
                        label="User Name"
                        placeholder="user name"
                        {...accountForm.getInputProps('username')}
                      />
                      <TextEditor content={BIO} label="Biography" />
                      <Button
                        style={{ width: 'fit-content' }}
                        leftSection={<IconDeviceFloppy size={ICON_SIZE} />}
                      >
                        Save Changes
                      </Button>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6, lg: 3, xl: 3 }}>
                    <Stack align="center">
                      <Avatar src={profile?.avatar} size={128} radius="50%">
                        {profile?.name?.[0]?.toUpperCase()}
                      </Avatar>
                      <FileButton
                        onChange={setFile}
                        accept="image/png,image/jpeg"
                      >
                        {(props) => (
                          <Button
                            {...props}
                            variant="subtle"
                            leftSection={<IconCloudUpload size={ICON_SIZE} />}
                          >
                            Upload image
                          </Button>
                        )}
                      </FileButton>
                      <Text ta="center" size="xs" c="dimmed">
                        For best results, use an image at least 128px by 128px
                        in .jpg format
                      </Text>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Surface>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Surface {...PAPER_PROPS}>
                <Stack>
                  <Text size="lg" fw={600}>
                    Account information
                  </Text>
                  <Group grow>
                    <TextInput
                      label="First name"
                      placeholder="first name"
                      {...accountInfoForm.getInputProps('firstname')}
                    />
                    <TextInput
                      label="Last name"
                      placeholder="last name"
                      {...accountInfoForm.getInputProps('lastname')}
                    />
                  </Group>
                  <TextInput
                    label="Email"
                    placeholder="email"
                    {...accountInfoForm.getInputProps('email')}
                  />
                  <TextInput
                    label="Address"
                    placeholder="address"
                    {...accountInfoForm.getInputProps('address')}
                  />
                  <TextInput
                    label="Apartment/Studio/Floor"
                    placeholder="apartment, studio, or floor"
                    {...accountInfoForm.getInputProps('apartment')}
                  />
                  <Group grow>
                    <TextInput
                      label="City"
                      placeholder="city"
                      {...accountInfoForm.getInputProps('city')}
                    />
                    <TextInput
                      label="State"
                      placeholder="state"
                      {...accountInfoForm.getInputProps('state')}
                    />
                    <TextInput
                      label="Zip"
                      placeholder="zip"
                      {...accountInfoForm.getInputProps('zip')}
                    />
                  </Group>
                  <Box style={{ width: 'auto' }}>
                    <Button
                      leftSection={<IconDeviceFloppy size={16} />}
                      onClick={handleSaveAccountInfo}
                      loading={profileLoading}
                    >
                      Save changes
                    </Button>
                  </Box>
                </Stack>
              </Surface>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </>
  );
}

export default Settings;
