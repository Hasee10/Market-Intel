'use client';

import { useEffect, useState } from 'react';
import {
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import { MdCheck } from 'react-icons/md';
import { IoMdMoon, IoMdSunny } from 'react-icons/io';
import { HiOutlineDesktopComputer } from 'react-icons/hi';

type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'ryvl-theme-preference';

function getSystemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Chakra only ever tracks a binary light/dark colorMode - "System" isn't a
// real third mode, just a preference that means "follow the OS and keep
// following it while this tab is open." That's why this needs its own
// localStorage key separate from Chakra's own color-mode cookie.
export function ThemeToggleMenu() {
  const { colorMode, setColorMode } = useColorMode();
  const [preference, setPreference] = useState<ThemePreference>('light');
  const navbarIcon = useColorModeValue('gray.400', 'white');
  const menuBg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setPreference(stored);
      if (stored === 'system') {
        setColorMode(getSystemPrefersDark() ? 'dark' : 'light');
      }
    }
    // Only needs to run once on mount to hydrate from storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setColorMode(e.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference, setColorMode]);

  const choose = (next: ThemePreference) => {
    setPreference(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    if (next === 'system') {
      setColorMode(getSystemPrefersDark() ? 'dark' : 'light');
    } else {
      setColorMode(next);
    }
  };

  const icon = preference === 'system' ? HiOutlineDesktopComputer : colorMode === 'light' ? IoMdSunny : IoMdMoon;

  return (
    <Menu>
      <MenuButton
        aria-label="Change theme"
        p="0px"
        bg="transparent"
        minW="unset"
        minH="unset"
        h="18px"
        w="max-content"
      >
        <Icon me="10px" h="18px" w="18px" color={navbarIcon} as={icon} />
      </MenuButton>
      <MenuList bg={menuBg} border="none" borderRadius="20px" p="10px" minW="160px">
        {(
          [
            { key: 'light', label: 'Light', icon: IoMdSunny },
            { key: 'dark', label: 'Dark', icon: IoMdMoon },
            { key: 'system', label: 'System', icon: HiOutlineDesktopComputer },
          ] as { key: ThemePreference; label: string; icon: typeof IoMdSunny }[]
        ).map((opt) => (
          <MenuItem
            key={opt.key}
            onClick={() => choose(opt.key)}
            borderRadius="8px"
            color={textColor}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Icon as={opt.icon} me="8px" />
            <span style={{ flex: 1, textAlign: 'left' }}>{opt.label}</span>
            {preference === opt.key && <Icon as={MdCheck} color="brand.500" />}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}
