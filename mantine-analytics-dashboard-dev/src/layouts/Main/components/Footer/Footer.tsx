import { Text } from '@mantine/core';

const FooterNav = () => {
  return (
    <Text size="sm" c="dimmed">
      &copy;&nbsp;{new Date().getFullYear()}&nbsp;Market Intel
    </Text>
  );
};

export default FooterNav;
