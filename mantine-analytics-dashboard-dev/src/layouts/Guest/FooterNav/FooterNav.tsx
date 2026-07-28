import { Container, Divider, Flex, Text } from '@mantine/core';

import { Logo } from '@/components';

import classes from './FooterNav.module.css';

const FooterNav = () => {
  return (
    <footer className={classes.footer}>
      <Container fluid mb="xl">
        <Divider mt="xl" mb="md" />
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          gap={{ base: 'sm', sm: 'lg' }}
          justify={{ base: 'center', sm: 'space-between' }}
          align={{ base: 'center' }}
        >
          <Logo c="white" />
          <Text ta="center" c="dimmed" size="sm">
            &copy;&nbsp;{new Date().getFullYear()}&nbsp;Market Intel
          </Text>
        </Flex>
      </Container>
    </footer>
  );
};

export default FooterNav;
