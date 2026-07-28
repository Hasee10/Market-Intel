'use client';

import {
  ActionIcon,
  Avatar,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconArrowRight,
  IconMenu2,
  IconPower,
  IconSettings,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { HeaderVariant, useSidebarConfig } from '@/contexts/theme-customizer';
import { createClient } from '@/lib/supabase/client';
import { useSellerSession } from '@/lib/supabase/useSellerSession';
import { PATH_DASHBOARD } from '@/routes';

const ICON_SIZE = 20;

type HeaderNavProps = {
  toggleMobile?: () => void;
  sidebarVisible: boolean;
  onSidebarToggle: () => void;
  onSidebarShow?: () => void;
  headerVariant: HeaderVariant;
};

const HeaderNav = (props: HeaderNavProps) => {
  const {
    toggleMobile,
    headerVariant,
    sidebarVisible,
    onSidebarToggle,
    onSidebarShow,
  } = props;
  const mobile_match = useMediaQuery('(max-width: 425px)');
  const sidebarConfig = useSidebarConfig();
  const router = useRouter();
  const { email, businessName } = useSellerSession();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/signin');
    router.refresh();
  };

  // Determine text color based on header variant
  const getTextColor = () => {
    if (headerVariant === 'colored') {
      return 'white';
    }
    return undefined; // Use default theme colors
  };

  const textColor = getTextColor();

  const handleSidebarToggle = () => {
    if (mobile_match) {
      // Mobile: toggle mobile menu
      toggleMobile?.();
    } else if (sidebarConfig.overlay && !sidebarVisible) {
      // Desktop overlay mode: show sidebar if hidden
      onSidebarShow?.();
    } else {
      // Normal mode or overlay mode with visible sidebar: toggle
      onSidebarToggle();
    }
  };

  const getSidebarToggleIcon = () => {
    if (mobile_match) {
      return <IconMenu2 size={ICON_SIZE} color={textColor} />;
    }

    // Desktop: use menu icon for overlay mode or when sidebar is hidden
    if (sidebarConfig.overlay || !sidebarVisible) {
      return <IconMenu2 size={ICON_SIZE} color={textColor} />;
    }

    // Use menu icon for normal mode when sidebar is visible
    return <IconMenu2 size={ICON_SIZE} color={textColor} />;
  };

  const getSidebarToggleTooltip = () => {
    if (mobile_match) return 'Toggle menu';
    if (!sidebarVisible) return 'Show sidebar';
    return 'Hide sidebar';
  };

  return (
    <Group justify="space-between" flex={1} wrap="nowrap">
      {/* Left Section: Sidebar Toggle */}
      <Group gap={0} style={{ flex: '0 0 auto' }}>
        <Tooltip label={getSidebarToggleTooltip()}>
          <ActionIcon
            onClick={handleSidebarToggle}
            variant={headerVariant === 'colored' ? 'transparent' : 'default'}
            size="lg"
          >
            {getSidebarToggleIcon()}
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Middle Section: Navigation & Search */}
      <Group gap={4} justify="center" style={{ flex: '1 1 auto' }}>
        <Tooltip label="Go back">
          <ActionIcon
            onClick={() => router.back()}
            variant={headerVariant === 'colored' ? 'transparent' : 'default'}
            size="lg"
          >
            <IconArrowLeft size={ICON_SIZE} color={textColor} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Go forward">
          <ActionIcon
            onClick={() => router.forward()}
            variant={headerVariant === 'colored' ? 'transparent' : 'default'}
            size="lg"
          >
            <IconArrowRight size={ICON_SIZE} color={textColor} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Right Section: Actions & User Menu */}
      <Group style={{ flex: '0 0 auto' }}>
        <Menu shadow="lg" width={280}>
          <Menu.Target>
            <Tooltip label="Account">
              <ActionIcon
                size="lg"
                variant={
                  headerVariant === 'colored' ? 'transparent' : 'default'
                }
                style={{ borderRadius: '50%' }}
              >
                <Avatar alt={businessName ?? email ?? 'Seller'} size="sm">
                  {(businessName ?? email ?? '?').charAt(0).toUpperCase()}
                </Avatar>
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  {businessName ?? 'Your store'}
                </Text>
                <Text size="xs">{email ?? ''}</Text>
              </Stack>
            </Menu.Label>
            <Menu.Divider />
            <Menu.Item
              component={Link}
              href={PATH_DASHBOARD.settings}
              leftSection={<IconSettings size={16} />}
            >
              Settings
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconPower size={16} />}
              color="red"
              onClick={handleLogout}
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
};

export default HeaderNav;
