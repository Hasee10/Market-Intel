'use client';

import { Flex, Icon, Text } from '@chakra-ui/react';
import { MdCheckCircle, MdRadioButtonUnchecked } from 'react-icons/md';

import { PASSWORD_RULES } from '@/lib/password';

type PasswordRequirementsProps = {
  password: string;
};

// Live checklist shown while choosing a new password (sign-up only - a
// sign-in form isn't the place to relitigate password rules for an account
// that already exists).
export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <Flex direction="column" gap="4px" mt="8px">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <Flex key={rule.key} align="center" gap="6px">
            <Icon
              as={met ? MdCheckCircle : MdRadioButtonUnchecked}
              boxSize="14px"
              color={met ? 'green.400' : 'gray.300'}
            />
            <Text fontSize="xs" color={met ? 'green.600' : 'gray.500'}>
              {rule.label}
            </Text>
          </Flex>
        );
      })}
    </Flex>
  );
}

export default PasswordRequirements;
