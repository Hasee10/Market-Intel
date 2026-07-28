'use client';

import {
  Badge,
  Box,
  Button,
  Container,
  ContainerProps,
  Flex,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAffiliate,
  IconBell,
  IconChartBar,
  IconMoodSmile,
  IconPlayerPlay,
  IconShieldLock,
} from '@tabler/icons-react';
import Link from 'next/link';

import GuestLayout from '@/layouts/Guest';
import { PATH_AUTH } from '@/routes';

import classes from './page.module.css';

const FEATURES = [
  {
    icon: IconChartBar,
    title: 'Store overview',
    description:
      'Track products, orders, and revenue in one place, pulled directly from your store data.',
  },
  {
    icon: IconMoodSmile,
    title: 'Customers & churn',
    description:
      'See which customers are at risk of churning before you lose them, not after.',
  },
  {
    icon: IconAffiliate,
    title: 'Market & peers',
    description:
      'Benchmark yourself against other sellers in your category using aggregated, opt-in data only.',
  },
  {
    icon: IconBell,
    title: 'Alerts',
    description:
      'Get notified when something in your store needs attention - no need to go looking for it.',
  },
];

export default function Home() {
  const tablet_match = useMediaQuery('(max-width: 768px)');

  const BOX_PROPS: ContainerProps = {
    pt: rem(80),
    pb: rem(60),
    px: tablet_match ? rem(36) : rem(40 * 3),
    className: classes.section,
  };

  return (
    <>
      <>
        <title>Market Intel</title>
        <meta
          name="description"
          content="Market Intel gives sellers a real-time view of their store performance and how they compare to peers in their category - using aggregated, opt-in benchmark data."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </>
      <GuestLayout>
        <Box className={classes.hero}>
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }} offset={{ md: 2 }}>
              <Stack align={tablet_match ? 'stretch' : 'center'} ta={tablet_match ? 'left' : 'center'}>
                <Title className={classes.title}>
                  Know how your store is really doing.
                </Title>
                <Text fz="lg">
                  Market Intel tracks your products, customers, and churn risk, and
                  benchmarks you against other sellers in your category - using only
                  aggregated, opt-in data. No guessing, no vanity metrics.
                </Text>
                <Group my="lg">
                  <Button
                    component={Link}
                    href={PATH_AUTH.signup}
                    size="lg"
                    leftSection={<IconPlayerPlay size={18} />}
                  >
                    Get started
                  </Button>
                  <Button
                    size="lg"
                    component={Link}
                    href={PATH_AUTH.signin}
                    variant="default"
                  >
                    Sign in
                  </Button>
                </Group>
              </Stack>
            </Grid.Col>
          </Grid>
        </Box>

        <Container fluid {...BOX_PROPS}>
          <Title order={2} ta="center" mb="xl">
            Everything you need to run your store with confidence
          </Title>
          <SimpleGrid
            cols={{ base: 1, sm: 2 }}
            spacing={{ base: 'sm', sm: 'lg' }}
            verticalSpacing={{ base: 'sm', sm: 'lg' }}
          >
            {FEATURES.map((feature) => (
              <Paper key={feature.title} p="md" withBorder className={classes.featureCard}>
                <Flex gap="md">
                  <ThemeIcon size="xl" radius="xl" variant="light">
                    <feature.icon style={{ fontSize: 20 }} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Title order={4}>{feature.title}</Title>
                    <Text fz="md">{feature.description}</Text>
                  </Stack>
                </Flex>
              </Paper>
            ))}
          </SimpleGrid>
        </Container>

        <Container fluid {...BOX_PROPS}>
          <Paper p="xl" withBorder className={classes.contactPaper}>
            <Group gap="xs" mb="sm">
              <ThemeIcon size="lg" radius="xl" variant="light" color="blue">
                <IconShieldLock style={{ fontSize: 18 }} />
              </ThemeIcon>
              <Badge variant="light" color="blue">
                Privacy-first benchmarking
              </Badge>
            </Group>
            <Title order={3} mb="xs">
              Peer benchmarking, not surveillance
            </Title>
            <Text c="dimmed">
              You only ever see aggregate or seller-opted-in fields for other sellers in
              your category - things like rating, price positioning, or response time.
              Nothing private about a competitor&apos;s business is ever shown, and your
              own data is only shared with peers if you choose to opt in.
            </Text>
          </Paper>
        </Container>
      </GuestLayout>
    </>
  );
}
