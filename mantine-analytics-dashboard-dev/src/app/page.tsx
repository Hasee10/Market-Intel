'use client';

import {
  Badge,
  Box,
  Button,
  Container,
  ContainerProps,
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
  IconArrowRight,
  IconChartBar,
  IconLink,
  IconLockAccess,
  IconMoodSmile,
  IconPlayerPlay,
  IconRadar,
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
      'Track products, orders, and revenue in one place, pulled directly from your store data - no spreadsheets, no manual exports.',
  },
  {
    icon: IconMoodSmile,
    title: 'Customers & churn',
    description:
      'See which customers are at risk of churning before you lose them, not after, based on real order history.',
  },
  {
    icon: IconAffiliate,
    title: 'Market & peers',
    description:
      'Benchmark yourself against other sellers in your category using aggregated, opt-in data only - never raw competitor data.',
  },
  {
    icon: IconLockAccess,
    title: 'Your data, your rules',
    description:
      'Nothing about your store is shared with peers unless you opt in, field by field. Private by default, always.',
  },
];

const STEPS = [
  {
    icon: IconLink,
    title: 'Connect your store',
    description: 'Set up your seller profile and pick the categories you sell in.',
  },
  {
    icon: IconChartBar,
    title: 'Track performance',
    description: 'Revenue, orders, inventory, and customer health update as your store does.',
  },
  {
    icon: IconRadar,
    title: 'Benchmark against peers',
    description: 'Opt in to see how you stack up in your category - price, rating, rank.',
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
          <Container fluid>
            <Grid align="center">
              <Grid.Col span={{ base: 12, md: 8 }} offset={{ md: 2 }}>
                <Stack
                  align={tablet_match ? 'stretch' : 'center'}
                  ta={tablet_match ? 'left' : 'center'}
                  gap="lg"
                >
                  <Badge
                    variant="light"
                    color="blue"
                    size="lg"
                    radius="sm"
                    className={classes.heroBadge}
                  >
                    Built for online sellers, not shoppers
                  </Badge>
                  <Title className={classes.title}>
                    Know how your store is really doing.
                  </Title>
                  <Text fz="lg" c="gray.4" maw={640}>
                    Market Intel tracks your products, customers, and churn risk, and
                    benchmarks you against other sellers in your category - using only
                    aggregated, opt-in data. No guessing, no vanity metrics.
                  </Text>
                  <Group my="md">
                    <Button
                      component={Link}
                      href={PATH_AUTH.signup}
                      size="lg"
                      rightSection={<IconArrowRight size={18} />}
                    >
                      Get started free
                    </Button>
                    <Button
                      size="lg"
                      component={Link}
                      href={PATH_AUTH.signin}
                      variant="default"
                      leftSection={<IconPlayerPlay size={18} />}
                    >
                      Sign in
                    </Button>
                  </Group>
                  <Group gap="xl" mt="md" className={classes.heroMeta}>
                    <Text size="sm" c="gray.5">
                      No credit card required
                    </Text>
                    <Text size="sm" c="gray.5">
                      Set up in minutes
                    </Text>
                    <Text size="sm" c="gray.5">
                      Cancel anytime
                    </Text>
                  </Group>
                </Stack>
              </Grid.Col>
            </Grid>
          </Container>
        </Box>

        <Container fluid {...BOX_PROPS}>
          <Stack align="center" gap={4} mb="xl">
            <Badge variant="light" color="blue">
              How it works
            </Badge>
            <Title order={2} ta="center">
              From raw store data to real answers
            </Title>
          </Stack>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
            {STEPS.map((step, index) => (
              <Stack key={step.title} align="center" ta="center" gap="xs">
                <ThemeIcon size={56} radius="xl" variant="light">
                  <step.icon style={{ fontSize: 26 }} />
                </ThemeIcon>
                <Text fw={700} c="dimmed" fz="sm">
                  Step {index + 1}
                </Text>
                <Title order={4}>{step.title}</Title>
                <Text fz="sm" c="dimmed" maw={280}>
                  {step.description}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Container>

        <Container fluid {...BOX_PROPS}>
          <Stack align="center" gap={4} mb="xl">
            <Badge variant="light" color="blue">
              Built for sellers
            </Badge>
            <Title order={2} ta="center">
              Everything you need to run your store with confidence
            </Title>
          </Stack>
          <SimpleGrid
            cols={{ base: 1, sm: 2 }}
            spacing={{ base: 'sm', sm: 'lg' }}
            verticalSpacing={{ base: 'sm', sm: 'lg' }}
          >
            {FEATURES.map((feature) => (
              <Paper key={feature.title} p="lg" radius="md" withBorder className={classes.featureCard}>
                <ThemeIcon size="xl" radius="md" variant="light" mb="sm">
                  <feature.icon style={{ fontSize: 20 }} />
                </ThemeIcon>
                <Title order={4} mb={4}>
                  {feature.title}
                </Title>
                <Text fz="md" c="dimmed">
                  {feature.description}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Container>

        <Container fluid {...BOX_PROPS}>
          <Paper p="xl" radius="md" withBorder className={classes.contactPaper}>
            <Group justify="center" gap="xs" mb="sm">
              <ThemeIcon size="lg" radius="xl" variant="light" color="blue">
                <IconShieldLock style={{ fontSize: 18 }} />
              </ThemeIcon>
              <Badge variant="light" color="blue">
                Privacy-first benchmarking
              </Badge>
            </Group>
            <Title order={3} mb="xs" ta="center">
              Peer benchmarking, not surveillance
            </Title>
            <Text c="dimmed" ta="center" maw={640} mx="auto">
              You only ever see aggregate or seller-opted-in fields for other sellers in
              your category - things like rating, price positioning, or category rank.
              Nothing private about a competitor&apos;s business is ever shown, and your
              own data is only shared with peers if you choose to opt in.
            </Text>
          </Paper>
        </Container>

        <Box className={classes.ctaBand}>
          <Container fluid py={rem(60)}>
            <Stack align="center" gap="md" ta="center">
              <Title order={2} c="white">
                Stop guessing how your store is doing.
              </Title>
              <Text c="gray.4" maw={480}>
                Create your seller account and see your real numbers in minutes.
              </Text>
              <Button
                component={Link}
                href={PATH_AUTH.signup}
                size="lg"
                rightSection={<IconArrowRight size={18} />}
              >
                Get started free
              </Button>
            </Stack>
          </Container>
        </Box>
      </GuestLayout>
    </>
  );
}
