'use client';

import { useState } from 'react';
import { IconButton, Input, InputGroup, InputProps, InputRightElement } from '@chakra-ui/react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';

// Was a plain `type="password"` input with no way to check what you typed -
// every auth form (sign in, sign up) had this same gap independently.
export function PasswordInput(props: InputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <Input {...props} type={visible ? 'text' : 'password'} pr="40px" />
      <InputRightElement>
        <IconButton
          aria-label={visible ? 'Hide password' : 'Show password'}
          icon={visible ? <MdVisibilityOff /> : <MdVisibility />}
          size="sm"
          variant="ghost"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
        />
      </InputRightElement>
    </InputGroup>
  );
}

export default PasswordInput;
