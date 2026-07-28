import {
  Box,
  Burger,
  Button,
  Container,
  Drawer,
  Group,
  ScrollArea,
  rem,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconPlayerPlay } from '@tabler/icons-react';
import Link from 'next/link';

import { Logo } from '@/components';
import { PATH_AUTH } from '@/routes';

import classes from './HeaderNav.module.css';

const HEADER_HEIGHT = rem(60);

const HeaderNav = () => {
  const theme = useMantineTheme();
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] =
    useDisclosure(false);
  const tablet_match = useMediaQuery('(max-width: 768px)');

  return (
    <Box>
      <header className={classes.header}>
        <Container className={classes.inner} fluid>
          <Logo style={{ color: theme.white }} />
          <Group gap="xs" className={classes.links}>
            <Button
              component={Link}
              href={PATH_AUTH.signin}
              variant="transparent"
              c="white"
              className={classes.link}
            >
              Sign in
            </Button>
            <Button
              component={Link}
              href={PATH_AUTH.signup}
              leftSection={<IconPlayerPlay size={16} />}
            >
              Get started
            </Button>
          </Group>
          <Burger
            opened={drawerOpened}
            onClick={toggleDrawer}
            className={classes.hiddenDesktop}
            color={theme.white}
          />
        </Container>
      </header>
      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        size="100%"
        padding="md"
        title="Menu"
        className={classes.hiddenDesktop}
        zIndex={1000000}
        transitionProps={{
          transition: tablet_match ? 'slide-up' : 'slide-left',
        }}
      >
        <ScrollArea h={`calc(100vh - ${rem(60)})`} mx="-md">
          <Button component={Link} href={PATH_AUTH.signin} fullWidth variant="default" mb="sm">
            Sign in
          </Button>
          <Button component={Link} href={PATH_AUTH.signup} fullWidth>
            Get started
          </Button>
        </ScrollArea>
      </Drawer>
    </Box>
  );
};

export default HeaderNav;
