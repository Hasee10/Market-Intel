'use client';

import { Button, Icon } from '@chakra-ui/react';
import { MdAddCircleOutline } from 'react-icons/md';

export default function TestPage() {
  return (
    <div>
      <Button variant="brand" leftIcon={<Icon as={MdAddCircleOutline} />} mt="20px">
        Save changes
      </Button>
    </div>
  );
}
